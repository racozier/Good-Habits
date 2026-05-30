import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ArrowLeft, Upload } from 'lucide-react';
import { db } from '../../db';
import { uid, today as todayFn } from '../../utils/dateUtils';
import ProgressBar from '../ui/ProgressBar';
import CountdownTimer from '../ui/CountdownTimer';
import Modal from '../ui/Modal';
import type { Book } from '../../types';

const EMOJIS = ['📚', '📖', '📕', '📗', '📘', '📙', '🔖', '✍️', '🧠', '🌍', '🚀', '💡'];

export default function BooksScreen() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [coverEmoji, setCoverEmoji] = useState('📚');
  const [pageInput, setPageInput] = useState('');

  useEffect(() => { loadBooks(); }, []);

  async function loadBooks() {
    const b = await db.books.orderBy('addedAt').reverse().toArray();
    setBooks(b);
  }

  async function addBook() {
    if (!title.trim() || !totalPages) return;
    const book: Book = {
      id: uid(), title: title.trim(), author: author.trim(),
      totalPages: parseInt(totalPages), currentPage: 0,
      coverEmoji, completed: false, addedAt: Date.now()
    };
    await db.books.add(book);
    setTitle(''); setAuthor(''); setTotalPages(''); setCoverEmoji('📚');
    setShowAdd(false); loadBooks();
  }

  async function updatePage(book: Book, page: number) {
    const clamped = Math.max(0, Math.min(page, book.totalPages));
    const completed = clamped >= book.totalPages;
    await db.books.update(book.id, { currentPage: clamped, completed });
    if (completed && !book.completed) {
      // Unlock 3 chapters of favorite book as reward
      const fav = await db.favoriteBook.get('favorite');
      if (fav) await db.favoriteBook.update('favorite', { unlockedChapters: fav.unlockedChapters + 3 });
      alert(`🎉 You finished "${book.title}"! Amazing work! You've earned a lazy day reward.`);
    }
    setSelectedBook(prev => prev ? { ...prev, currentPage: clamped, completed } : null);
    loadBooks();
  }

  async function deleteBook(id: string) {
    await db.books.delete(id);
    setSelectedBook(null); loadBooks();
  }

  async function handleEpubUpload(book: Book, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = ev.target?.result as string;
      await db.books.update(book.id, { epubData: data });
      loadBooks();
      alert('EPUB uploaded! You can now read it in the app.');
    };
    reader.readAsDataURL(file);
  }

  if (selectedBook) {
    const pct = selectedBook.totalPages > 0
      ? Math.round((selectedBook.currentPage / selectedBook.totalPages) * 100) : 0;
    return (
      <div className="screen" style={{ padding: '0 16px 80px' }}>
        <div style={{ padding: '16px 4px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSelectedBook(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={24} color="var(--color-text)" />
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--color-text)', flex: 1 }}>
            {selectedBook.title}
          </h2>
        </div>

        <div className="card" style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 72, marginBottom: 8 }}>{selectedBook.coverEmoji}</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>{selectedBook.title}</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: '0 0 16px' }}>{selectedBook.author}</p>
          {selectedBook.completed && (
            <div style={{ background: '#4CAF5020', borderRadius: 10, padding: '8px 16px', marginBottom: 12 }}>
              <span style={{ color: '#4CAF50', fontWeight: 600 }}>✅ Finished! Great job!</span>
            </div>
          )}
          <ProgressBar value={pct} label={`Page ${selectedBook.currentPage} of ${selectedBook.totalPages}`} />
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Update page</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="number" placeholder="Current page" value={pageInput}
              onChange={e => setPageInput(e.target.value)} style={{ flex: 1 }} />
            <button className="btn-primary" onClick={() => { updatePage(selectedBook, parseInt(pageInput)); setPageInput(''); }}>
              Update
            </button>
          </div>
          <input type="range" min={0} max={selectedBook.totalPages}
            value={selectedBook.currentPage}
            onChange={e => updatePage(selectedBook, parseInt(e.target.value))}
            style={{ width: '100%', marginTop: 12, accentColor: 'var(--color-primary)' }} />
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <button className="btn-primary" onClick={() => setShowTimer(true)} style={{ width: '100%', marginBottom: 8 }}>
            ⏱ Start 15-min reading session
          </button>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', padding: '12px', border: '1.5px dashed var(--color-border)', borderRadius: 12 }}>
            <Upload size={18} color="var(--color-primary)" />
            <span style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 600 }}>
              {selectedBook.epubData ? 'EPUB uploaded ✓' : 'Upload EPUB to read in-app'}
            </span>
            <input type="file" accept=".epub" style={{ display: 'none' }} onChange={e => handleEpubUpload(selectedBook, e)} />
          </label>
        </div>

        <button onClick={() => deleteBook(selectedBook.id)} className="btn-ghost"
          style={{ width: '100%', color: '#E88', borderColor: '#E88' }}>
          <Trash2 size={16} style={{ marginRight: 6 }} /> Delete book
        </button>

        <Modal open={showTimer} onClose={() => setShowTimer(false)} title="Reading Session">
          <CountdownTimer minutes={15} label={`Reading: ${selectedBook.title}`}
            onComplete={async () => {
              await db.readingEntries.add({ id: uid(), date: todayFn(), minutes: 15, bookId: selectedBook.id });
              setShowTimer(false);
              alert('📖 15 minutes logged! Great reading session!');
            }} />
        </Modal>
      </div>
    );
  }

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Books</h2>
        <button onClick={() => setShowAdd(s => !s)} style={{
          background: 'var(--color-primary)', border: 'none', borderRadius: 12, padding: '8px 14px',
          color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14
        }}>
          <Plus size={16} /> Add
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card" style={{ marginBottom: 12 }}>
            <input className="input" placeholder="Book title *" value={title}
              onChange={e => setTitle(e.target.value)} style={{ marginBottom: 8 }} />
            <input className="input" placeholder="Author" value={author}
              onChange={e => setAuthor(e.target.value)} style={{ marginBottom: 8 }} />
            <input className="input" type="number" placeholder="Total pages *" value={totalPages}
              onChange={e => setTotalPages(e.target.value)} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>Pick cover emoji:</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setCoverEmoji(e)} style={{
                  fontSize: 24, background: coverEmoji === e ? 'var(--color-secondary)' : 'var(--color-bg)',
                  border: 'none', borderRadius: 8, padding: '6px', cursor: 'pointer'
                }}>{e}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={addBook} style={{ flex: 1 }}>Add Book</button>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {books.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>📚</div>
          <p style={{ fontSize: 16 }}>Add your first book to start tracking</p>
        </div>
      )}

      {books.map((book, i) => {
        const pct = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
        return (
          <motion.div key={book.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            onClick={() => setSelectedBook(book)} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '16px',
              background: 'var(--color-surface)', borderRadius: 16, marginBottom: 10,
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
            <div style={{ fontSize: 48, width: 56, height: 56, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'var(--color-bg)', borderRadius: 12 }}>
              {book.coverEmoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 15, color: 'var(--color-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</p>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-text-muted)' }}>{book.author}</p>
              <ProgressBar value={pct} showPercent={true} height={6} />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                {book.currentPage} / {book.totalPages} pages
                {book.completed && ' · ✅ Finished!'}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
