import { useEffect, useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import JSZip from 'jszip';
import { useAppStore } from '../../store/appStore';

interface RomanChapter { numeral: string; html: string; }

// Validates a string is a Roman numeral (I–C range covers any book)
const ROMAN_RE = /^(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
function isRoman(s: string): boolean {
  const t = s.trim().toUpperCase();
  return t.length > 0 && ROMAN_RE.test(t);
}

async function parseEpubByRomanNumerals(dataUrl: string): Promise<RomanChapter[]> {
  // Decode dataURL → Uint8Array
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);

  const zip = await JSZip.loadAsync(buf.buffer);

  // Find OPF
  const containerXml = await zip.file('META-INF/container.xml')!.async('string');
  const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1] ?? '';
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml = await zip.file(opfPath)!.async('string');

  // Build manifest
  const manifest: Record<string, string> = {};
  for (const m of opfXml.matchAll(/<item\s[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"/g)) {
    manifest[m[1]] = m[2];
  }

  // Spine order — all content files
  const spineIds = [...opfXml.matchAll(/<itemref\s[^>]*\bidref="([^"]+)"/g)].map(m => m[1]);

  // Collect all HTML in spine order, stripping head/styles
  let combined = '';
  for (const id of spineIds) {
    const href = manifest[id];
    if (!href || !href.match(/\.(xhtml|html|htm)$/i)) continue;
    const fullPath = opfDir + href;
    const file = zip.file(fullPath) ?? zip.file(href);
    if (!file) continue;
    let raw = await file.async('string');

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

    // Strip head and stylesheets
    raw = raw.replace(/<head[\s\S]*?<\/head>/i, '');
    raw = raw.replace(/<link[^>]+(?:stylesheet|text\/css)[^>]*\/?>/gi, '');
    raw = raw.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Extract body content
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i) ?? raw.match(/<body[^>]*>([\s\S]*)/i);
    combined += bodyMatch ? bodyMatch[1] : raw;
  }

  // Split combined HTML by Roman numeral headings
  // Match any block-level tag whose trimmed text content is solely a Roman numeral
  const tagRe = /<(h[1-6]|p|div)[^>]*>\s*(<[^>]+>)?\s*([A-Za-z]+)\s*(<\/[^>]+>)?\s*<\/\1>/g;
  const splits: { index: number; numeral: string; matchLen: number }[] = [];

  for (const m of [...combined.matchAll(tagRe)]) {
    const candidate = m[3].trim();
    if (isRoman(candidate)) {
      splits.push({ index: m.index!, numeral: candidate.toUpperCase(), matchLen: m[0].length });
    }
  }

  // Fallback: no Roman numerals found — return entire text as one chapter
  if (splits.length === 0) {
    return [{ numeral: 'I', html: combined }];
  }

  // Build chapters: each chapter = from its Roman numeral heading to the next
  const chapters: RomanChapter[] = [];

  // Preamble before first Roman numeral (dedicate/intro) — attach to Chapter I
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index;
    const end = i + 1 < splits.length ? splits[i + 1].index : combined.length;
    chapters.push({ numeral: splits[i].numeral, html: combined.slice(start, end) });
  }

  return chapters;
}

const READER_CSS = `
  * { box-sizing: border-box; max-width: 100%; }
  p, div, span, li, td, blockquote, section, article {
    color: #1a1a1a !important;
    background: transparent !important;
  }
  h1,h2,h3,h4,h5,h6 {
    color: #111 !important;
    background: transparent !important;
    margin: 1.4em 0 0.6em;
    line-height: 1.3;
  }
  p { margin: 0 0 1em; }
  em, i { font-style: italic; }
  strong, b { font-weight: 700; }
  img { max-width: 100%; height: auto; display: block; margin: 1.5em auto; }
  a { color: #888 !important; text-decoration: none; }
  [style*="color"] { color: #1a1a1a !important; }
  [style*="background"] { background: transparent !important; }
`;

export default function BookReaderScreen() {
  const { epubReader, closeEpub } = useAppStore();
  const [chapters, setChapters] = useState<RomanChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const chapterIndex = epubReader?.startChapter ?? 0;
  const ch = chapters[chapterIndex];

  useEffect(() => {
    if (!epubReader?.data) return;
    setLoading(true);
    setError('');
    parseEpubByRomanNumerals(epubReader.data)
      .then(chs => { setChapters(chs); setLoading(false); })
      .catch(e => { setError('Could not read book: ' + e.message); setLoading(false); });
  }, [epubReader?.data]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [chapterIndex]);

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
          {ch && (
            <div style={{ fontSize: 12, color: '#999', marginTop: 1 }}>
              Chapter {ch.numeral}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '28px 22px 60px', WebkitOverflowScrolling: 'touch' } as any}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '30vh', color: '#aaa', fontSize: 15 }}>
            Opening book…
          </div>
        )}
        {error && (
          <div style={{ padding: 32, textAlign: 'center', color: '#c44', fontSize: 14, lineHeight: 1.7 }}>{error}</div>
        )}
        {ch && !loading && (
          <div
            style={{ fontSize: 18, lineHeight: 1.85, color: '#1a1a1a', maxWidth: 660, margin: '0 auto', fontFamily: 'Georgia, serif' }}
            dangerouslySetInnerHTML={{ __html: ch.html }}
          />
        )}
        {!ch && !loading && !error && (
          <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            This chapter is not yet unlocked.
          </div>
        )}
      </div>
    </div>
  );
}
