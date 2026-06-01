import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, List } from 'lucide-react';
import JSZip from 'jszip';

interface Props {
  epubData: string;   // dataURL
  title: string;
  startChapter?: number;
  onClose: () => void;
}

interface Chapter { title: string; html: string; }

async function parseEpub(dataUrl: string): Promise<Chapter[]> {
  // dataURL → ArrayBuffer
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);

  const zip = await JSZip.loadAsync(buf.buffer);

  // 1. Find OPF path from META-INF/container.xml
  const containerXml = await zip.file('META-INF/container.xml')!.async('string');
  const opfPath = containerXml.match(/full-path="([^"]+\.opf)"/)?.[1];
  if (!opfPath) throw new Error('No OPF found');

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml = await zip.file(opfPath)!.async('string');

  // 2. Build id→href manifest
  const manifestMap: Record<string, string> = {};
  const manifestRe = /<item\s[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*/g;
  let m: RegExpExecArray | null;
  while ((m = manifestRe.exec(opfXml))) manifestMap[m[1]] = m[2];

  // 3. Spine order
  const spineIds: string[] = [];
  const spineRe = /<itemref\s[^>]*idref="([^"]+)"/g;
  while ((m = spineRe.exec(opfXml))) spineIds.push(m[1]);

  // 4. NCX/NAV titles
  const titleMap: Record<string, string> = {};
  const ncxId = Object.keys(manifestMap).find(id => manifestMap[id].endsWith('.ncx'));
  if (ncxId) {
    const ncxPath = opfDir + manifestMap[ncxId];
    const ncxXml = await zip.file(ncxPath)?.async('string') ?? '';
    const navRe = /<navPoint[^>]*>[\s\S]*?<text>([^<]+)<\/text>[\s\S]*?<content\s[^>]*src="([^"#]+)/g;
    while ((m = navRe.exec(ncxXml))) {
      const src = m[2].split('/').pop()!;
      titleMap[src] = m[1].trim();
    }
  }

  // 5. Extract each spine item as HTML, patch image/style src to inline blobs
  const chapters: Chapter[] = [];
  for (let i = 0; i < spineIds.length; i++) {
    const href = manifestMap[spineIds[i]];
    if (!href) continue;
    const fullPath = opfDir + href;
    const file = zip.file(fullPath);
    if (!file) continue;
    let html = await file.async('string');

    // Inline images as blob data URLs
    const imgRe = /src="([^"]+)"/g;
    const imgMatches = [...html.matchAll(/src="([^"]+)"/g)];
    for (const match of imgMatches) {
      const imgRelPath = match[1];
      if (imgRelPath.startsWith('data:') || imgRelPath.startsWith('http')) continue;
      const imgFullPath = fullPath.includes('/')
        ? fullPath.slice(0, fullPath.lastIndexOf('/') + 1) + imgRelPath
        : imgRelPath;
      const imgFile = zip.file(imgFullPath);
      if (imgFile) {
        const imgB64 = await imgFile.async('base64');
        const ext = imgRelPath.split('.').pop()?.toLowerCase() ?? 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
        html = html.replace(match[0], `src="data:${mime};base64,${imgB64}"`);
      }
    }

    // Strip head, keep body content only
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const content = bodyMatch ? bodyMatch[1] : html;

    const filename = href.split('/').pop()!;
    const chTitle = titleMap[filename] || `Chapter ${i + 1}`;
    chapters.push({ title: chTitle, html: content });
  }
  return chapters;
}

export default function EpubReader({ epubData, title, startChapter = 0, onClose }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [current, setCurrent] = useState(startChapter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showToc, setShowToc] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    setLoading(true);
    setError('');
    parseEpub(epubData)
      .then(chs => { setChapters(chs); setLoading(false); })
      .catch(e => { setError('Could not parse EPUB: ' + e.message); setLoading(false); });
  }, [epubData]);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [current]);

  const go = useCallback((dir: 1 | -1) => {
    setCurrent(c => Math.max(0, Math.min(chapters.length - 1, c + dir)));
  }, [chapters.length]);

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  }

  const ch = chapters[current];

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#fdfbf7', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        padding: '10px 16px', paddingTop: 'max(env(safe-area-inset-top), 10px)',
        background: '#fff', borderBottom: '1px solid #e8e8e8',
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={22} color="#444" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          {ch && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{ch.title} · {current + 1}/{chapters.length}</div>}
        </div>
        <button onClick={() => setShowToc(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <List size={20} color="#666" />
        </button>
      </div>

      {/* TOC drawer */}
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
            }}>
              {c.title}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', WebkitOverflowScrolling: 'touch' } as any}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#888', fontSize: 15 }}>
            Parsing book…
          </div>
        )}
        {error && (
          <div style={{ padding: 32, textAlign: 'center', color: '#c44', fontSize: 14 }}>{error}</div>
        )}
        {ch && !loading && (
          <div
            style={{ fontSize: 17, lineHeight: 1.75, color: '#2a2a2a', maxWidth: 640, margin: '0 auto' }}
            dangerouslySetInnerHTML={{ __html: ch.html }}
          />
        )}
      </div>

      {/* Footer nav */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        padding: '10px 20px', paddingBottom: 'max(env(safe-area-inset-bottom), 10px)',
        background: '#fff', borderTop: '1px solid #e8e8e8',
      }}>
        <button onClick={() => go(-1)} disabled={current === 0} style={{
          background: 'none', border: '1.5px solid #ddd', borderRadius: 12, padding: '10px 18px',
          cursor: current === 0 ? 'default' : 'pointer', opacity: current === 0 ? 0.3 : 1,
        }}>
          <ChevronLeft size={20} color="#444" />
        </button>
        <span style={{ fontSize: 12, color: '#bbb' }}>
          {chapters.length > 0 ? `${current + 1} / ${chapters.length}` : ''}
        </span>
        <button onClick={() => go(1)} disabled={current >= chapters.length - 1} style={{
          background: 'none', border: '1.5px solid #ddd', borderRadius: 12, padding: '10px 18px',
          cursor: current >= chapters.length - 1 ? 'default' : 'pointer',
          opacity: current >= chapters.length - 1 ? 0.3 : 1,
        }}>
          <ChevronRight size={20} color="#444" />
        </button>
      </div>
    </div>,
    document.body
  );
}
