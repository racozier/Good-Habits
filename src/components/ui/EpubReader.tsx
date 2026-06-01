import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
// @ts-ignore
import ePub from 'epubjs';

interface Props {
  epubData: string;   // dataURL: "data:application/epub+zip;base64,..."
  title: string;
  startChapter?: number;
  onClose: () => void;
}

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)![1];
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

export default function EpubReader({ epubData, title, startChapter = 0, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const blobUrlRef = useRef<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const touchStartX = useRef(0);

  useEffect(() => {
    // epub.js needs a real URL or ArrayBuffer — convert dataURL → Blob URL
    const blob = dataURLtoBlob(epubData);
    const blobUrl = URL.createObjectURL(blob);
    blobUrlRef.current = blobUrl;

    const book = ePub(blobUrl);

    const el = containerRef.current!;
    // Must pass explicit pixel dimensions, not percentages
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight - 120;

    const rendition = book.renderTo(el, {
      width: w,
      height: h,
      spread: 'none',
      flow: 'paginated',
    });
    renditionRef.current = rendition;

    rendition.on('rendered', () => setLoading(false));

    book.ready
      .then(() => {
        const spineItems: any[] = (book.spine as any)?.spineItems || [];
        const href = startChapter > 0 && startChapter < spineItems.length
          ? spineItems[startChapter].href
          : undefined;
        return href ? rendition.display(href) : rendition.display();
      })
      .catch(() => {
        setError('Could not open this EPUB. The file may be DRM-protected or corrupted.');
        setLoading(false);
      });

    return () => {
      try { book.destroy(); } catch { /* ignore */ }
      URL.revokeObjectURL(blobUrl);
    };
  }, [epubData, startChapter]);

  const prev = () => renditionRef.current?.prev();
  const next = () => renditionRef.current?.next();

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#faf8f4', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        padding: '12px 16px', paddingTop: 'max(env(safe-area-inset-top), 12px)',
        background: '#fff', borderBottom: '1px solid #eee',
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={22} color="#444" />
        </button>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#222' }}>
          {title}
        </span>
      </div>

      {/* Book canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {loading && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#888', fontSize: 15, pointerEvents: 'none' }}>
            Loading…
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 32, textAlign: 'center', color: '#c44', fontSize: 15 }}>
            {error}
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Nav */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        padding: '10px 24px', paddingBottom: 'max(env(safe-area-inset-bottom), 10px)',
        background: '#fff', borderTop: '1px solid #eee',
      }}>
        <button onClick={prev} style={{ background: 'none', border: '1.5px solid #ddd', borderRadius: 12, padding: '10px 20px', cursor: 'pointer' }}>
          <ChevronLeft size={20} color="#444" />
        </button>
        <span style={{ fontSize: 11, color: '#bbb' }}>swipe or tap arrows</span>
        <button onClick={next} style={{ background: 'none', border: '1.5px solid #ddd', borderRadius: 12, padding: '10px 20px', cursor: 'pointer' }}>
          <ChevronRight size={20} color="#444" />
        </button>
      </div>
    </div>,
    document.body
  );
}
