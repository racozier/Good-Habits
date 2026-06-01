import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Bookmark, BookOpen } from 'lucide-react';
import JSZip from 'jszip';
import { useAppStore } from '../../store/appStore';

interface RomanChapter { numeral: string; html: string; }

function romanToInt(s: string): number {
  const vals: Record<string, number> = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };
  let result = 0;
  const t = s.toUpperCase();
  for (let i = 0; i < t.length; i++) {
    const cur = vals[t[i]] ?? 0;
    const next = vals[t[i + 1]] ?? 0;
    result += cur < next ? -cur : cur;
  }
  return result;
}

const ROMAN_RE = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
function isRoman(s: string): boolean {
  const t = s.trim().toUpperCase();
  return t.length > 0 && ROMAN_RE.test(t);
}

function sanitize(html: string): string {
  return html
    .replace(/\s+style="[^"]*"/gi, '')
    .replace(/\s+style='[^']*'/gi, '')
    .replace(/\s+bgcolor="[^"]*"/gi, '')
    .replace(/\s+color="[^"]*"/gi, '')
    .replace(/\s+background="[^"]*"/gi, '')
    .replace(/<font[^>]*>/gi, '').replace(/<\/font>/gi, '');
}

function extractBody(raw: string): string {
  const s = raw
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<link[^>]+>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  const m = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i) ?? s.match(/<body[^>]*>([\s\S]*)/i);
  return m ? m[1] : s.replace(/<\/?(html|body)[^>]*>/gi, '').trim();
}

// Detect if a file's HTML starts with a Roman numeral heading
function detectRomanNumeral(html: string): string | null {
  const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  const blocks = Array.from(doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div'));
  for (const el of blocks.slice(0, 15)) {
    const text = (el.textContent ?? '').trim();
    if (text.length >= 1 && text.length <= 12 && isRoman(text)) return text.toUpperCase();
  }
  return null;
}

async function parseEpub(dataUrl: string): Promise<{ chapters: RomanChapter[]; debug: string }> {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  const zip = await JSZip.loadAsync(buf.buffer);

  // OPF
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('Invalid EPUB: missing META-INF/container.xml');
  const containerXml = await containerFile.async('string');
  const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1] ?? '';
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml = await zip.file(opfPath)!.async('string');

  // Manifest
  const manifest: Record<string, string> = {};
  for (const m of opfXml.matchAll(/<item\s[^>]*\bid="([^"']+)"[^>]*\bhref="([^"']+)"/g)) manifest[m[1]] = m[2];
  for (const m of opfXml.matchAll(/<item\s[^>]*\bid='([^"']+)'[^>]*\bhref='([^"']+)'/g)) manifest[m[1]] = m[2];

  // Spine
  let spineIds = [...opfXml.matchAll(/<itemref\s[^>]*\bidref="([^"]+)"/g)].map(m => m[1]);
  if (!spineIds.length) spineIds = [...opfXml.matchAll(/idref=['"]([^'"]+)['"]/g)].map(m => m[1]);

  let orderedPaths: string[] = spineIds.map(id => manifest[id]).filter(Boolean).map(h => opfDir + h);

  // Fallback: scan zip
  if (!orderedPaths.length) {
    zip.forEach(path => { if (path.match(/\.(xhtml|html|htm)$/i) && !path.match(/toc|nav\./i)) orderedPaths.push(path); });
    orderedPaths.sort();
  }

  // Load each file
  const files: { path: string; html: string }[] = [];
  for (const fullPath of orderedPaths) {
    const file = zip.file(fullPath) ?? zip.file(fullPath.replace(/^\//, ''));
    if (!file) continue;
    let raw = await file.async('string');

    // Inline images
    const fileDir = fullPath.includes('/') ? fullPath.slice(0, fullPath.lastIndexOf('/') + 1) : opfDir;
    for (const m of [...raw.matchAll(/src="([^"]+\.(jpe?g|png|gif|svg|webp))"/gi)]) {
      const rel = m[1];
      if (rel.startsWith('data:') || rel.startsWith('http')) continue;
      for (const c of [fileDir + rel, opfDir + rel, rel]) {
        const imgFile = zip.file(c);
        if (imgFile) {
          const b64 = await imgFile.async('base64');
          const ext = rel.split('.').pop()!.toLowerCase();
          const mime = /jpe?g/.test(ext) ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
          raw = raw.replace(m[0], `src="data:${mime};base64,${b64}"`);
          break;
        }
      }
    }
    files.push({ path: fullPath, html: sanitize(extractBody(raw)) });
  }

  if (!files.length) throw new Error(`No content files found. Paths tried: ${orderedPaths.length}`);

  // Build chapters: each file that starts with a Roman numeral = new chapter
  // Files without Roman numerals get appended to the previous chapter
  const chapters: RomanChapter[] = [];
  for (const { html } of files) {
    if (!html.trim()) continue;
    const numeral = detectRomanNumeral(html);
    if (numeral) {
      chapters.push({ numeral, html });
    } else if (chapters.length > 0) {
      chapters[chapters.length - 1].html += '\n' + html;
    }
    // Pre-chapter preamble (cover, title page, etc.) is skipped
  }

  // If no Roman numerals anywhere, just split by file
  if (!chapters.length) {
    files.forEach((f, i) => {
      if (f.html.trim()) chapters.push({ numeral: String(i + 1), html: f.html });
    });
  } else {
    // Sort by Roman numeral value so I < II < III... regardless of file order
    chapters.sort((a, b) => romanToInt(a.numeral) - romanToInt(b.numeral));
  }

  return { chapters, debug: `${files.length} files, ${chapters.length} chapters` };
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

function bookmarkKey(title: string) { return `epub-bookmark-${title}`; }

export default function BookReaderScreen() {
  const { epubReader, closeEpub } = useAppStore();
  const [chapters, setChapters] = useState<RomanChapter[]>([]);
  const [current, setCurrent] = useState(epubReader?.startChapter ?? 0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debug, setDebug] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // From Rewards: locked to the unlocked chapter index
  // From Books: free navigation
  const isRewards = epubReader?.returnScreen === 'rewards';

  useEffect(() => {
    if (!epubReader?.data) return;
    setLoading(true); setError('');

    // Load bookmark for books-tab reading
    if (!isRewards && epubReader.title) {
      const saved = localStorage.getItem(bookmarkKey(epubReader.title));
      if (saved !== null) setCurrent(parseInt(saved));
    }

    parseEpub(epubReader.data)
      .then(({ chapters: chs, debug: d }) => {
        setChapters(chs);
        setDebug(d);
        // For rewards, use the passed chapter index directly
        if (isRewards) setCurrent(epubReader.startChapter ?? 0);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [epubReader?.data]);

  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [current]);

  const go = useCallback((dir: 1 | -1) => {
    setCurrent(c => {
      const next = Math.max(0, Math.min(chapters.length - 1, c + dir));
      // Auto-save position for books-tab reading
      if (!isRewards && epubReader?.title) localStorage.setItem(bookmarkKey(epubReader.title), String(next));
      return next;
    });
  }, [chapters.length, isRewards, epubReader?.title]);

  function toggleBookmark() {
    if (!epubReader?.title) return;
    const key = bookmarkKey(epubReader.title);
    if (bookmarked) { localStorage.removeItem(key); setBookmarked(false); }
    else { localStorage.setItem(key, String(current)); setBookmarked(true); }
  }

  useEffect(() => {
    if (!epubReader?.title) return;
    setBookmarked(localStorage.getItem(bookmarkKey(epubReader.title)) === String(current));
  }, [current, epubReader?.title]);

  if (!epubReader) return null;

  const ch = chapters[current];
  const canPrev = current > 0;
  const canNext = current < chapters.length - 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#faf8f4' }}>
      <style>{READER_CSS}</style>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', paddingTop: 'max(env(safe-area-inset-top), 10px)',
        background: '#faf8f4', borderBottom: '1px solid #e8e0d0',
      }}>
        <button onClick={closeEpub} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={22} color="#444" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {epubReader.title}
          </div>
          {ch && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>Chapter {ch.numeral}{!isRewards && chapters.length > 1 ? ` · ${current + 1} / ${chapters.length}` : ''}</div>}
        </div>
        {!isRewards && (
          <button onClick={toggleBookmark} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Bookmark size={20} color={bookmarked ? 'var(--color-primary)' : '#ccc'} fill={bookmarked ? 'var(--color-primary)' : 'none'} />
          </button>
        )}
        {!isRewards && chapters.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <BookOpen size={14} color="#aaa" />
            <span style={{ fontSize: 11, color: '#aaa' }}>{chapters.length}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '28px 22px 100px' } as any}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '30vh', color: '#aaa', fontSize: 15 }}>
            Opening book…
          </div>
        )}
        {error && (
          <div style={{ padding: 20, color: '#c44', fontSize: 13, lineHeight: 1.7, background: '#fff5f5', borderRadius: 12 }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        {!loading && !error && !ch && (
          <div style={{ padding: 20, color: '#888', fontSize: 13, background: '#f5f5f5', borderRadius: 12 }}>
            Chapter not found. Debug: {debug}
          </div>
        )}
        {ch && !loading && (
          <div
            key={current}
            style={{ fontSize: 18, lineHeight: 1.85, color: '#1a1a1a', maxWidth: 660, margin: '0 auto', fontFamily: 'Georgia, serif' }}
            dangerouslySetInnerHTML={{ __html: ch.html }}
          />
        )}
      </div>

      {/* Bottom nav — only for Books tab */}
      {!isRewards && chapters.length > 1 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 20px', paddingBottom: 'max(env(safe-area-inset-bottom), 10px)',
          background: '#faf8f4', borderTop: '1px solid #e8e0d0',
        }}>
          <button onClick={() => go(-1)} disabled={!canPrev} style={{
            background: 'none', border: '1.5px solid #ddd', borderRadius: 12,
            padding: '10px 20px', cursor: canPrev ? 'pointer' : 'default', opacity: canPrev ? 1 : 0.3,
          }}><ChevronLeft size={20} color="#444" /></button>
          <span style={{ fontSize: 12, color: '#bbb' }}>{current + 1} / {chapters.length}</span>
          <button onClick={() => go(1)} disabled={!canNext} style={{
            background: 'none', border: '1.5px solid #ddd', borderRadius: 12,
            padding: '10px 20px', cursor: canNext ? 'pointer' : 'default', opacity: canNext ? 1 : 0.3,
          }}><ChevronRight size={20} color="#444" /></button>
        </div>
      )}
    </div>
  );
}
