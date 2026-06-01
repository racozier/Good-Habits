import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ArrowLeft, Upload, StickyNote, Check } from 'lucide-react';
import { db } from '../../db';
import { uid, today as todayFn } from '../../utils/dateUtils';
import ProgressBar from '../ui/ProgressBar';
import CountdownTimer from '../ui/CountdownTimer';
import Modal from '../ui/Modal';
import type { Book, BookNote } from '../../types';

const COVER_COLORS = ['#E8916A','#5B9EA0','#C8D5A0','#F7DC8A','#F5A07A','#9B8EC4','#6BAED6','#74C476'];

function BookCover({ title, color, coverImage, size = 56 }: { title: string; color: string; coverImage?: string; size?: number }) {
  const w = coverImage ? Math.round(size * 0.67) : size;
  const h = coverImage ? size : size;
  if (coverImage) {
    return (
      <div style={{ width: w, height: h, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
        boxShadow: '2px 3px 10px rgba(0,0,0,0.25)' }}>
        <img src={coverImage} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontWeight: 800, fontSize: size * 0.4, color: 'white',
      textTransform: 'uppercase', userSelect: 'none',
    }}>
      {title.charAt(0)}
    </div>
  );
}

export default function BooksScreen() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0]);
  const [pageInput, setPageInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => { loadBooks(); }, []);

  async function loadBooks() {
    const b = await db.books.toArray();
    setBooks(b.sort((a, z) => z.addedAt - a.addedAt));
  }

  async function loadNotes(bookId: string) {
    const n = await db.bookNotes.where('bookId').equals(bookId).toArray();
    setNotes(n.sort((a, b) => b.createdAt - a.createdAt));
  }

  async function addBook() {
    const trimmedTitle = title.trim();
    const pages = parseInt(totalPages);
    if (!trimmedTitle || !totalPages || isNaN(pages) || pages <= 0) return;

    const book: Book = {
      id: uid(),
      title: trimmedTitle,
      author: author.trim(),
      totalPages: pages,
      currentPage: 0,
      coverColor,
      completed: false,
      addedAt: Date.now(),
    };
    await db.books.put(book);
    setTitle(''); setAuthor(''); setTotalPages(''); setCoverColor(COVER_COLORS[0]);
    setShowAdd(false);
    await loadBooks();
  }

  async function updatePage(book: Book, page: number) {
    const clamped = Math.max(0, Math.min(page, book.totalPages));
    const completed = clamped >= book.totalPages;
    await db.books.update(book.id, { currentPage: clamped, completed });
    if (completed && !book.completed) {
      const fav = await db.favoriteBook.get('favorite');
      if (fav) await db.favoriteBook.update('favorite', { unlockedChapters: fav.unlockedChapters + 3 });
    }
    const updated = { ...book, currentPage: clamped, completed };
    setSelectedBook(updated);
    setBooks(prev => prev.map(b => b.id === book.id ? updated : b));
  }

  async function deleteBook(id: string) {
    if (!confirm('Delete this book?')) return;
    await db.books.delete(id);
    await db.bookNotes.where('bookId').equals(id).delete();
    setSelectedBook(null);
    loadBooks();
  }

  async function addNote() {
    if (!noteInput.trim() || !selectedBook) return;
    const note: BookNote = {
      id: uid(), bookId: selectedBook.id,
      content: noteInput.trim(), createdAt: Date.now()
    };
    await db.bookNotes.add(note);
    setNoteInput('');
    loadNotes(selectedBook.id);
  }

  async function deleteNote(id: string) {
    await db.bookNotes.delete(id);
    if (selectedBook) loadNotes(selectedBook.id);
  }

  async function handleCoverUpload(book: Book, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = ev.target?.result as string;
      await db.books.update(book.id, { coverImage: data });
      setSelectedBook({ ...book, coverImage: data });
      loadBooks();
    };
    reader.readAsDataURL(file);
  }

  async function handleEpubUpload(book: Book, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = ev.target?.result as string;
      await db.books.update(book.id, { epubData: data });
      loadBooks();
    };
    reader.readAsDataURL(file);
  }

  // Book detail view
  if (selectedBook) {
    const pct = selectedBook.totalPages > 0
      ? Math.round((selectedBook.currentPage / selectedBook.totalPages) * 100) : 0;

    return (
      <div className="screen" style={{ padding: '0 16px 80px' }}>
        <div style={{ padding: '16px 4px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSelectedBook(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={24} color="var(--color-text)" />
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--color-text)', flex: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedBook.title}
          </h2>
        </div>

        {/* Cover + info */}
        <div className="card" style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'center' }}>
          <label style={{ cursor: 'pointer', position: 'relative' }}>
            <BookCover title={selectedBook.title} color={selectedBook.coverColor} coverImage={selectedBook.coverImage} size={selectedBook.coverImage ? 150 : 72} />
            <div style={{
              position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,0.5)',
              borderRadius: '0 0 10px 0', padding: '3px 5px', display: 'flex', alignItems: 'center',
            }}>
              <Upload size={11} color="white" />
            </div>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCoverUpload(selectedBook, e)} />
          </label>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 2px' }}>{selectedBook.title}</h3>
            {selectedBook.author && <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: '0 0 8px' }}>{selectedBook.author}</p>}
            {selectedBook.completed && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#4CAF5020', borderRadius: 20, padding: '4px 10px' }}>
                <Check size={14} color="#4CAF50" />
                <span style={{ color: '#4CAF50', fontWeight: 600, fontSize: 13 }}>Finished!</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="card" style={{ marginBottom: 12 }}>
          <ProgressBar value={pct} label={`Page ${selectedBook.currentPage} of ${selectedBook.totalPages}`} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input className="input" type="number" placeholder="Current page" value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (updatePage(selectedBook, parseInt(pageInput)), setPageInput(''))}
              style={{ flex: 1 }} />
            <button className="btn-primary" onClick={() => { updatePage(selectedBook, parseInt(pageInput)); setPageInput(''); }}>
              Update
            </button>
          </div>
          <input type="range" min={0} max={selectedBook.totalPages} value={selectedBook.currentPage}
            onChange={e => updatePage(selectedBook, parseInt(e.target.value))}
            style={{ width: '100%', marginTop: 12, accentColor: 'var(--color-primary)' }} />
        </div>

        {/* Actions */}
        <div className="card" style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-primary" onClick={() => setShowTimer(true)} style={{ width: '100%' }}>
            ⏱ Start 15-min reading session
          </button>
          <button onClick={() => { setShowNotes(true); loadNotes(selectedBook.id); }} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px', border: '1.5px solid var(--color-border)', borderRadius: 12,
            background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text)', fontWeight: 500
          }}>
            <StickyNote size={18} color="var(--color-primary)" />
            Notes ({notes.length > 0 ? notes.length : '...'})
          </button>
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', padding: '12px', border: '1.5px dashed var(--color-border)', borderRadius: 12
          }}>
            <Upload size={18} color="var(--color-primary)" />
            <span style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 600 }}>
              {selectedBook.epubData ? '✓ EPUB uploaded' : 'Upload EPUB to read in-app'}
            </span>
            <input type="file" accept=".epub" style={{ display: 'none' }} onChange={e => handleEpubUpload(selectedBook, e)} />
          </label>
        </div>

        <button onClick={() => deleteBook(selectedBook.id)} style={{
          width: '100%', padding: '12px', border: '1.5px solid #E88', borderRadius: 12,
          background: 'none', cursor: 'pointer', color: '#E88', fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          <Trash2 size={16} /> Delete book
        </button>

        {/* Reading timer modal */}
        <Modal open={showTimer} onClose={() => setShowTimer(false)} title="Reading Session">
          <CountdownTimer minutes={15} label={`Reading: ${selectedBook.title}`}
            onComplete={async () => {
              await db.readingEntries.add({ id: uid(), date: todayFn(), minutes: 15, bookId: selectedBook.id });
              setShowTimer(false);
            }} />
          <button className="btn-ghost" onClick={async () => {
            await db.readingEntries.add({ id: uid(), date: todayFn(), minutes: 15, bookId: selectedBook.id });
            setShowTimer(false);
          }} style={{ width: '100%', marginTop: 12 }}>
            ✓ Mark as done manually
          </button>
        </Modal>

        {/* Notes modal */}
        <Modal open={showNotes} onClose={() => setShowNotes(false)} title={`Notes — ${selectedBook.title}`}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <textarea className="input" placeholder="Add a note..." value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              style={{ flex: 1, resize: 'none', minHeight: 72 }} />
            <button className="btn-primary" onClick={addNote} style={{ alignSelf: 'flex-end', padding: '10px 14px' }}>
              Add
            </button>
          </div>
          {notes.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>No notes yet</p>
          )}
          {notes.map(note => (
            <div key={note.id} style={{
              padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, marginBottom: 8,
              borderLeft: '3px solid var(--color-primary)', display: 'flex', gap: 10, alignItems: 'flex-start'
            }}>
              <p style={{ margin: 0, flex: 1, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.content}</p>
              <button onClick={() => deleteNote(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                <Trash2 size={14} color="var(--color-text-muted)" />
              </button>
            </div>
          ))}
        </Modal>
      </div>
    );
  }

  // Book list view
  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowAdd(s => !s)} style={{
          background: 'var(--color-primary)', border: 'none', borderRadius: 12, padding: '8px 14px',
          color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600
        }}>
          <Plus size={16} /> Add Book
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="card" style={{ marginBottom: 14 }}>
            <input className="input" placeholder="Book title *" value={title}
              onChange={e => setTitle(e.target.value)} style={{ marginBottom: 8 }} />
            <input className="input" placeholder="Author (optional)" value={author}
              onChange={e => setAuthor(e.target.value)} style={{ marginBottom: 8 }} />
            <input className="input" type="number" placeholder="Total pages *" value={totalPages}
              onChange={e => setTotalPages(e.target.value)} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>Cover colour:</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {COVER_COLORS.map(c => (
                <button key={c} onClick={() => setCoverColor(c)} style={{
                  width: 32, height: 32, borderRadius: '50%', background: c, border: 'none',
                  cursor: 'pointer', outline: coverColor === c ? '3px solid var(--color-text)' : '3px solid transparent',
                  outlineOffset: 2,
                }} />
              ))}
            </div>
            {/* Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
              padding: '10px 14px', background: 'var(--color-bg)', borderRadius: 12 }}>
              <BookCover title={title || '?'} color={coverColor} size={44} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{title || 'Book title'}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>{author || 'Author'}</p>
              </div>
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
            transition={{ delay: 0.04 * i }}
            onClick={() => { setSelectedBook(book); loadNotes(book.id); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: 'var(--color-surface)', borderRadius: 16, marginBottom: 10,
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
            <div style={{ position: 'relative' }}>
              <BookCover title={book.title} color={book.coverColor} coverImage={book.coverImage} size={52} />
              {book.completed && (
                <div style={{
                  position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                  borderRadius: '50%', background: '#4CAF50',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Check size={12} color="white" strokeWidth={3} />
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 15, color: 'var(--color-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</p>
              {book.author && <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--color-text-muted)' }}>{book.author}</p>}
              <ProgressBar value={pct} showPercent={true} height={5} />
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                {book.currentPage} / {book.totalPages} pages
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
