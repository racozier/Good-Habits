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

function splitByRomanNumerals(html: string): RomanChapter[] {
  // Use DOMParser so nested tags, whitespace and encoding don't fool us
  const doc = new DOMParser().parseFromString('<html><body>' + html + '</body></html>', 'text/html');

  // Walk every block element and mark those whose TEXT is solely a Roman numeral
  let markerIdx = 0;
  const markers: { numeral: string; attr: string }[] = [];
  const BLOCK = new Set(['h1','h2','h3','h4','h5','h6','p','div','section','header']);

  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    if (!BLOCK.has(el.tagName.toLowerCase())) continue;
    const text = (el.textContent ?? '').trim();
    if (!isRoman(text)) continue;
    const attr = `data-rch="${markerIdx++}"`;
    el.setAttribute('data-rch', String(markerIdx - 1));
    markers.push({ numeral: text.toUpperCase(), attr });
  }

  // Re-serialize: DOMParser normalises the HTML cleanly
  const marked = doc.body.innerHTML;

  // Find split positions using the data-rch markers
  const splits: { index: number; numeral: string }[] = [];
  for (let i = 0; i < markers.length; i++) {
    const search = `data-rch="${i}"`;
    const attrPos = marked.indexOf(search);
    if (attrPos === -1) continue;
    const elemStart = marked.lastIndexOf('<', attrPos);
    splits.push({ index: elemStart, numeral: markers[i].numeral });
  }

  // Sort by position (should already be sorted but just in case)
  splits.sort((a, b) => a.index - b.index);

  if (splits.length === 0) return [{ numeral: 'I', html: marked }];

  const chapters: RomanChapter[] = [];
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index;
    const end = i + 1 < splits.length ? splits[i + 1].index : marked.length;
    chapters.push({ numeral: splits[i].numeral, html: marked.slice(start, end) });
  }
  return chapters;
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

  // Manifest — try both single and double quotes, with and without \b
  const manifest: Record<string, string> = {};
  for (const m of opfXml.matchAll(/<item\s[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"/g)) {
    manifest[m[1]] = m[2];
  }
  // Some EPUBs use single quotes
  for (const m of opfXml.matchAll(/<item\s[^>]*\bid='([^']+)'[^>]*\bhref='([^']+)'/g)) {
    manifest[m[1]] = m[2];
  }

  // Spine order — try both quote styles
  let spineIds = [...opfXml.matchAll(/<itemref\s[^>]*\bidref="([^"]+)"/g)].map(m => m[1]);
  if (spineIds.length === 0) {
    spineIds = [...opfXml.matchAll(/<itemref\s[^>]*idref="([^"]+)"/g)].map(m => m[1]);
  }
  if (spineIds.length === 0) {
    spineIds = [...opfXml.matchAll(/idref=['"]([^'"]+)['"]/g)].map(m => m[1]);
  }

  // Build ordered file paths from spine
  let orderedPaths: string[] = [];
  for (const id of spineIds) {
    const href = manifest[id];
    if (href) orderedPaths.push(opfDir + href);
  }

  // Fallback: if spine gave nothing, scan zip for all HTML/XHTML files
  if (orderedPaths.length === 0) {
    zip.forEach((path) => {
      if (path.match(/\.(xhtml|html|htm)$/i) && !path.match(/toc|nav\./i)) {
        orderedPaths.push(path);
      }
    });
    orderedPaths.sort();
  }

  let combined = '';
  let filesProcessed = 0;

  for (const fullPath of orderedPaths) {
    const file = zip.file(fullPath)
      ?? zip.file(fullPath.replace(/^\//, ''));
    if (!file) continue;

    let raw = await file.async('string');
    filesProcessed++;

    // Inline images
    const fileDir = fullPath.includes('/') ? fullPath.slice(0, fullPath.lastIndexOf('/') + 1) : opfDir;
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

  // Split using DOM-based Roman numeral detection
  const chapters = splitByRomanNumerals(combined);
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
