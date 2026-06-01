import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, List } from 'lucide-react';
import JSZip from 'jszip';

interface Props {
  epubData: string;
  title: string;
  startChapter?: number;
  onClose: () => void;
}

interface Chapter { title: string; html: string; }

function extractBody(raw: string): string {
  // Remove head section entirely
  const noHead = raw.replace(/<head[\s\S]*?<\/head>/i, '');
  // Try to get body content
  const bodyMatch = noHead.match(/<body[^>]*>([\s\S]*?)<\/body>\s*<\/html>/i)
    ?? noHead.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];
  // No body tag — strip html/xml wrappers and return whatever is left
  return noHead.replace(/<\/?(?:html|xml)[^>]*>/gi, '').trim();
}

async function parseEpub(dataUrl: string): Promise<Chapter[]> {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);

  const zip = await JSZip.loadAsync(buf.buffer);

  // --- Try proper OPF spine approach ---
  let orderedPaths: string[] = [];
  let opfDir = '';

  try {
    const containerFile = zip.file('META-INF/container.xml');
    if (containerFile) {
      const containerXml = await containerFile.async('string');
      const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1];
      if (opfPath) {
        opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
        const opfXml = await zip.file(opfPath)!.async('string');

        // Build manifest
        const manifest: Record<string, string> = {};
        for (const m of opfXml.matchAll(/<item\s[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"/g)) {
          manifest[m[1]] = m[2];
        }

        // Spine order
        const spineIds = [...opfXml.matchAll(/<itemref\s[^>]*\bidref="([^"]+)"/g)].map(m => m[1]);

        for (const id of spineIds) {
          const href = manifest[id];
          if (href && href.match(/\.(xhtml|html|htm)$/i)) {
            orderedPaths.push(opfDir + href);
          }
        }
      }
    }
  } catch { /* fall through to scan */ }

  // --- Fallback: scan zip for all HTML/XHTML files ---
  if (orderedPaths.length === 0) {
    zip.forEach((path) => {
      if (path.match(/\.(xhtml|html|htm)$/i)) orderedPaths.push(path);
    });
    orderedPaths.sort();
  }

  // Filter out obvious nav/toc files
  const contentPaths = orderedPaths.filter(p => !p.match(/\/(toc|nav|cover|ncx)\./i));

  // Build NCX title map
  const titleMap: Record<string, string> = {};
  try {
    let ncxFile: JSZip.JSZipObject | null = null;
    zip.forEach((p, f) => { if (p.match(/\.ncx$/i)) ncxFile = f; });
    if (ncxFile) {
      const ncxXml = await (ncxFile as JSZip.JSZipObject).async('string');
      for (const m of ncxXml.matchAll(/<navPoint[\s\S]*?<text>([^<]+)<\/text>[\s\S]*?<content[^>]+src="([^"#]+)/g)) {
        titleMap[m[2].split('/').pop()!] = m[1].trim();
      }
    }
  } catch { /* titles optional */ }

  const chapters: Chapter[] = [];

  for (let i = 0; i < contentPaths.length; i++) {
    const fullPath = contentPaths[i];
    const file = zip.file(fullPath);
    if (!file) continue;

    let raw = await file.async('string');
    const fileDir = fullPath.includes('/') ? fullPath.slice(0, fullPath.lastIndexOf('/') + 1) : '';

    // Inline images
    for (const m of [...raw.matchAll(/(?:src|href)="([^"]+\.(jpe?g|png|gif|svg|webp))"/gi)]) {
      const rel = m[1];
      if (rel.startsWith('data:') || rel.startsWith('http')) continue;
      // Try multiple path resolutions
      const candidates = [fileDir + rel, opfDir + rel, rel];
      for (const candidate of candidates) {
        const imgFile = zip.file(candidate);
        if (imgFile) {
          const b64 = await imgFile.async('base64');
          const ext = rel.split('.').pop()!.toLowerCase();
          const mime = /jpe?g/.test(ext) ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
          raw = raw.replace(m[0], m[0].replace(rel, `data:${mime};base64,${b64}`));
          break;
        }
      }
    }

    // Strip external stylesheet links only (keep inline style attributes)
    raw = raw.replace(/<link[^>]+(?:stylesheet|text\/css)[^>]*\/?>/gi, '');
    // Strip <style> blocks that set colors/backgrounds (they'll override our reset)
    raw = raw.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    const content = extractBody(raw);
    const filename = fullPath.split('/').pop()!;
    const chTitle = titleMap[filename] ?? `Chapter ${chapters.length + 1}`;
    chapters.push({ title: chTitle, html: content });
  }

  if (chapters.length === 0) throw new Error('No chapters found — the EPUB may be DRM-protected.');
  return chapters;
}

const BASE_CSS = `
  * { box-sizing: border-box; max-width: 100%; }
  p, div, span, li, td, th, blockquote, section, article {
    color: #2a2a2a !important;
    background: transparent !important;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #111 !important;
    background: transparent !important;
    margin: 1.2em 0 0.5em;
    line-height: 1.3;
  }
  p { margin: 0 0 0.9em; }
  img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
  a { color: #666 !important; text-decoration: underline; }
  [style*="color"] { color: #2a2a2a !important; }
  [style*="background"] { background: transparent !important; }
`;

export default function EpubReader({ epubData, title, startChapter = 0, onClose }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [current, setCurrent] = useState(startChapter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showToc, setShowToc] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    setLoading(true); setError('');
    parseEpub(epubData)
      .then(chs => {
        setChapters(chs);
        setCurrent(Math.min(startChapter, Math.max(0, chs.length - 1)));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [epubData]);

  useEffect(() => { contentRef.current?.scrollTo(0, 0); }, [current]);

  const go = useCallback((dir: 1 | -1) => {
    setCurrent(c => Math.max(0, Math.min(chapters.length - 1, c + dir)));
  }, [chapters.length]);

  const ch = chapters[current];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fdfbf7', display: 'flex', flexDirection: 'column' }}>
      <style>{BASE_CSS}</style>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        padding: '10px 16px', paddingTop: 'max(env(safe-area-inset-top), 10px)',
        background: '#fff', borderBottom: '1px solid #e8e8e8',
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={22} color="#444" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {ch && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{ch.title} · {current + 1} / {chapters.length}</div>}
        </div>
        <button onClick={() => setShowToc(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <List size={20} color="#666" />
        </button>
      </div>

      {showToc && (
        <div style={{
          position: 'absolute', top: 56, left: 0, right: 0, zIndex: 10,
          background: '#fff', borderBottom: '1px solid #eee', maxHeight: '50vh', overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          {chapters.map((c, i) => (
            <button key={i} onClick={() => { setCurrent(i); setShowToc(false); }} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '13px 20px',
              background: i === current ? '#f0ebe3' : 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: i === current ? 700 : 400, color: '#333',
              borderBottom: '1px solid #f0f0f0',
            }}>{c.title}</button>
          ))}
        </div>
      )}

      <div
        ref={contentRef}
        style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' } as any}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => { const dx = e.changedTouches[0].clientX - touchStartX.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}
      >
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#888' }}>
            Parsing book…
          </div>
        )}
        {error && (
          <div style={{ padding: 32, textAlign: 'center', color: '#c44', fontSize: 14, lineHeight: 1.6 }}>{error}</div>
        )}
        {ch && !loading && (
          <div
            key={current}
            style={{ fontSize: 17, lineHeight: 1.75, color: '#2a2a2a', maxWidth: 640, margin: '0 auto' }}
            dangerouslySetInnerHTML={{ __html: ch.html }}
          />
        )}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        padding: '10px 20px', paddingBottom: 'max(env(safe-area-inset-bottom), 10px)',
        background: '#fff', borderTop: '1px solid #e8e8e8',
      }}>
        <button onClick={() => go(-1)} disabled={current === 0} style={{
          background: 'none', border: '1.5px solid #ddd', borderRadius: 12, padding: '10px 18px',
          opacity: current === 0 ? 0.3 : 1, cursor: current === 0 ? 'default' : 'pointer',
        }}><ChevronLeft size={20} color="#444" /></button>
        <span style={{ fontSize: 12, color: '#bbb' }}>{chapters.length > 0 ? `${current + 1} / ${chapters.length}` : ''}</span>
        <button onClick={() => go(1)} disabled={current >= chapters.length - 1} style={{
          background: 'none', border: '1.5px solid #ddd', borderRadius: 12, padding: '10px 18px',
          opacity: current >= chapters.length - 1 ? 0.3 : 1, cursor: current >= chapters.length - 1 ? 'default' : 'pointer',
        }}><ChevronRight size={20} color="#444" /></button>
      </div>
    </div>
  );
}
