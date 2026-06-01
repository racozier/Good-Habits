import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
// @ts-ignore
import ePub from 'epubjs';

interface Props {
  epubData: string;
  title: string;
  startChapter?: number; // 0-based spine index
  onClose: () => void;
}

export default function EpubReader({ epubData, title, startChapter = 0, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState('');
  const touchStartX = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const book = ePub(epubData);
      bookRef.current = book;

      const rendition = book.renderTo(containerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
      });
      renditionRef.current = rendition;

      rendition.on('locationChanged', (loc: any) => {
        setLocation(loc?.start?.cfi || '');
        setLoading(false);
      });

      book.ready.then(() => {
        const spine = book.spine as any;
        const spineItems = spine?.spineItems || [];
        if (startChapter > 0 && startChapter < spineItems.length) {
          rendition.display(spineItems[startChapter].href).catch(() => rendition.display());
        } else {
          rendition.display();
        }
      }).catch(() => {
        setError('Could not load book. The EPUB file may be corrupted.');
        setLoading(false);
      });
    } catch {
      setError('Could not open EPUB file.');
      setLoading(false);
    }

    return () => {
      try { bookRef.current?.destroy(); } catch { /* ignore */ }
    };
  }, [epubData, startChapter]);

  function prev() { renditionRef.current?.prev(); }
  function next() { renditionRef.current?.next(); }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: '#faf8f4', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', paddingTop: 'max(env(safe-area-inset-top), 12px)',
        background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={22} color="#444" />
        </button>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#222' }}>
          {title}
        </span>
      </div>

      {/* Book area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {loading && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#888', fontSize: 15 }}>
            Loading book…
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

      {/* Nav bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 24px', paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
        background: '#fff', borderTop: '1px solid #eee', flexShrink: 0,
      }}>
        <button onClick={prev} style={{
          background: 'none', border: '1.5px solid #ddd', borderRadius: 12,
          padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
        }}>
          <ChevronLeft size={20} color="#444" />
        </button>
        <span style={{ fontSize: 12, color: '#aaa' }}>Swipe or tap arrows</span>
        <button onClick={next} style={{
          background: 'none', border: '1.5px solid #ddd', borderRadius: 12,
          padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
        }}>
          <ChevronRight size={20} color="#444" />
        </button>
      </div>
    </div>,
    document.body
  );
}
