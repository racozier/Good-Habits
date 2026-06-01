import { useEffect, useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import JSZip from 'jszip';
import { useAppStore } from '../../store/appStore';

interface RomanChapter { numeral: string; html: string; }

const ROMAN_RE = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
function isRoman(s: string): boolean {
  const t = s.trim().toUpperCase();
  return t.length > 0 && ROMAN_RE.test(t);
}

function extractBodyContent(raw: string): string {
  // 1. Remove XML declaration, DOCTYPE, and entire <head>
  let s = raw
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<link[^>]+>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // 2. Try to get body content
  const bodyMatch = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    ?? s.match(/<body[^>]*>([\s\S]*)/i);
  if (bodyMatch) return bodyMatch[1];

  // 3. Strip any remaining html/body wrapper tags and return whatever's left
  return s.replace(/<\/?(html|body)[^>]*>/gi, '').trim();
}

function sanitizeHtml(html: string): string {
  // Strip ALL inline style/color/bgcolor attributes so our CSS controls everything.
  // This fixes white-text-on-white-background from books with dark themes.
  return html
    .replace(/\s+style="[^"]*"/gi, '')
    .replace(/\s+style='[^']*'/gi, '')
    .replace(/\s+bgcolor="[^"]*"/gi, '')
    .replace(/\s+color="[^"]*"/gi, '')
    .replace(/\s+background="[^"]*"/gi, '')
    .replace(/<font[^>]*>/gi, '')
    .replace(/<\/font>/gi, '');
}

async function parseEpubByRomanNumerals(dataUrl: string): Promise<{ chapters: RomanChapter[]; debug: string }> {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);

  const zip = await JSZip.loadAsync(buf.buffer);

  // Find OPF
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('No META-INF/container.xml found — invalid EPUB');
  const containerXml = await containerFile.async('string');
  const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1] ?? '';
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml = await zip.file(opfPath)!.async('string');

  // Manifest
  const manifest: Record<string, string> = {};
  for (const m of opfXml.matchAll(/<item\s[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"/g)) {
    manifest[m[1]] = m[2];
  }

  // Spine order
  const spineIds = [...opfXml.matchAll(/<itemref\s[^>]*\bidref="([^"]+)"/g)].map(m => m[1]);

  let combined = '';
  let filesProcessed = 0;

  for (const id of spineIds) {
    const href = manifest[id];
    if (!href) continue;
    // Accept any file type — some EPUBs use .xhtml, some .html, some omit extension
    const fullPath = opfDir + href;

    // Try different path variations
    const file = zip.file(fullPath)
      ?? zip.file(href)
      ?? zip.file(href.replace(/^\//, ''));
    if (!file) continue;

    let raw = await file.async('string');
    filesProcessed++;

    // Inline images
    const fileDir = fullPath.includes('/') ? fullPath.slice(0, fullPath.lastIndexOf('/') + 1) : '';
    for (const m of [...raw.matchAll(/src="([^"]+\.(jpe?g|png|gif|svg|webp))"/gi)]) {
      const rel = m[1];
      if (rel.startsWith('data:') || rel.startsWith('http')) continue;
      for (const candidate of [fileDir + rel, opfDir + rel, rel]) {
        const imgFile = zip.file(candidate);
        if (imgFile) {
          const b64 = await imgFile.async('base64');
          const ext = rel.split('.').pop()!.toLowerCase();
          const mime = /jpe?g/.test(ext) ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
          raw = raw.replace(m[0], `src="data:${mime};base64,${b64}"`);
          break;
        }
      }
    }

    combined += sanitizeHtml(extractBodyContent(raw)) + '\n';
  }

  const debug = `Files: ${filesProcessed}, Combined length: ${combined.length} chars`;

  if (combined.trim().length === 0) {
    throw new Error(`Book text could not be extracted. ${debug}`);
  }

  // Split by Roman numeral headings.
  // Strategy: find any tag that contains ONLY a Roman numeral as its visible text,
  // with optional nested inline tags (span, strong, em, b, i).
  const splits: { index: number; numeral: string }[] = [];

  // Pattern: <TAG ...> (optional inline tags) ROMAN_NUMERAL (optional closing inline tags) </TAG>
  // TAG = h1-h6, p, div
  const tagRe = /<(h[1-6]|p|div)[^>]*>((?:<[^/][^>]*>)*)\s*([A-Za-z]{1,10})\s*((?:<\/[^>]+>)*)<\/\1>/gi;

  for (const m of [...combined.matchAll(tagRe)]) {
    const candidate = m[3].trim();
    if (isRoman(candidate)) {
      splits.push({ index: m.index!, numeral: candidate.toUpperCase() });
    }
  }

  if (splits.length === 0) {
    // No Roman numerals found — return whole book as one chapter
    return { chapters: [{ numeral: 'I', html: combined }], debug: debug + ' | No Roman numerals detected, showing full text' };
  }

  const chapters: RomanChapter[] = [];
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index;
    const end = i + 1 < splits.length ? splits[i + 1].index : combined.length;
    chapters.push({ numeral: splits[i].numeral, html: combined.slice(start, end) });
  }

  return { chapters, debug: debug + ` | ${chapters.length} Roman-numeral chapters found` };
}

const READER_CSS = `
  * { box-sizing: border-box; max-width: 100%; color: #1a1a1a; background: transparent; }
  p { margin: 0 0 1em; }
  h1,h2,h3,h4,h5,h6 { margin: 1.4em 0 0.6em; line-height: 1.3; text-align: center; }
  em, i { font-style: italic; }
  strong, b { font-weight: 700; }
  img { max-width: 100%; height: auto; display: block; margin: 1.5em auto; }
  a { color: #888; text-decoration: none; }
`;

export default function BookReaderScreen() {
  const { epubReader, closeEpub } = useAppStore();
  const [chapters, setChapters] = useState<RomanChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const chapterIndex = epubReader?.startChapter ?? 0;
  const ch = chapters[chapterIndex];

  useEffect(() => {
    if (!epubReader?.data) return;
    setLoading(true);
    setError('');
    parseEpubByRomanNumerals(epubReader.data)
      .then(({ chapters: chs, debug }) => {
        setChapters(chs);
        setDebugInfo(debug);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [epubReader?.data]);

  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [chapterIndex]);

  if (!epubReader) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#faf8f4' }}>
      <style>{READER_CSS}</style>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', paddingTop: 'max(env(safe-area-inset-top), 12px)',
        background: '#faf8f4', borderBottom: '1px solid #e8e0d0',
      }}>
        <button onClick={closeEpub} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={22} color="#444" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#222' }}>{epubReader.title}</div>
          {ch && <div style={{ fontSize: 12, color: '#999', marginTop: 1 }}>Chapter {ch.numeral}</div>}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '28px 22px 60px' } as any}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '30vh', color: '#aaa', fontSize: 15 }}>
            Opening book…
          </div>
        )}
        {error && (
          <div style={{ padding: 24, color: '#c44', fontSize: 13, lineHeight: 1.7, background: '#fff5f5', borderRadius: 12, margin: '20px 0' }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        {!loading && !error && ch && ch.html.trim().length === 0 && (
          <div style={{ padding: 24, color: '#888', fontSize: 13, lineHeight: 1.7, background: '#f5f5f5', borderRadius: 12, margin: '20px 0' }}>
            Chapter parsed but appears empty. Debug: {debugInfo}
          </div>
        )}
        {ch && ch.html.trim().length > 0 && !loading && (
          <div
            style={{ fontSize: 18, lineHeight: 1.85, color: '#1a1a1a', maxWidth: 660, margin: '0 auto', fontFamily: 'Georgia, serif' }}
            dangerouslySetInnerHTML={{ __html: ch.html }}
          />
        )}
        {!loading && !error && chapters.length > 0 && !ch && (
          <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            Chapter {chapterIndex + 1} not found (book has {chapters.length} chapters). Debug: {debugInfo}
          </div>
        )}
      </div>
    </div>
  );
}
