import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { db } from '../../db';
import { today, uid, formatDate, addDays } from '../../utils/dateUtils';
import type { DiaryEntry, Mood } from '../../types';

const MOODS: { id: Mood; emoji: string; label: string }[] = [
  { id: 'great', emoji: '😊', label: 'Great' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'bad', emoji: '😔', label: 'Rough' },
];

export default function DiaryScreen() {
  const [currentDate, setCurrentDate] = useState(today());
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<Mood | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => { loadEntry(); }, [currentDate]);

  async function loadEntry() {
    setEditing(false);
    setJustSaved(false);
    const e = await db.diaryEntries.where('date').equals(currentDate).first();
    if (e) {
      setEntry(e);
      setContent(e.content);
      setMood(e.mood);
    } else {
      setEntry(null);
      setContent('');
      setMood(undefined);
      setEditing(true); // auto open editor for new days
    }
  }

  async function save() {
    if (!content.trim()) return;
    if (entry) {
      await db.diaryEntries.update(entry.id, { content, mood });
      setEntry({ ...entry, content, mood });
    } else {
      const newEntry: DiaryEntry = { id: uid(), date: currentDate, content, mood };
      await db.diaryEntries.add(newEntry);
      setEntry(newEntry);
    }
    setEditing(false);
    setJustSaved(true);
  }

  const isToday = currentDate === today();

  function goBack() { setCurrentDate(addDays(currentDate, -1)); }
  function goForward() {
    const next = addDays(currentDate, 1);
    if (next <= today()) setCurrentDate(next);
  }

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Diary</h2>
      </div>

      {/* Date navigation */}
      <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 10 }}>
          <ChevronLeft size={22} color="var(--color-text)" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
            {isToday ? 'Today' : formatDate(currentDate).split(',')[0]}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>{formatDate(currentDate)}</p>
        </div>
        <button onClick={goForward} disabled={isToday}
          style={{ background: 'none', border: 'none', cursor: isToday ? 'default' : 'pointer', padding: 10, opacity: isToday ? 0.3 : 1 }}>
          <ChevronRight size={22} color="var(--color-text)" />
        </button>
      </div>

      {/* Saved entry view */}
      {entry && !editing && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {entry.mood && (
                <span style={{ fontSize: 22 }}>{MOODS.find(m => m.id === entry.mood)?.emoji}</span>
              )}
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                {entry.mood ? MOODS.find(m => m.id === entry.mood)?.label : ''}
              </span>
              {justSaved && (
                <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>✓ Saved</span>
              )}
            </div>
            <button onClick={() => setEditing(true)} style={{
              background: 'none', border: '1.5px solid var(--color-border)', borderRadius: 10,
              padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: 'var(--color-text)'
            }}>
              <Pencil size={14} /> Edit
            </button>
          </div>
          <p style={{
            margin: 0, fontSize: 15, lineHeight: 1.8, color: 'var(--color-text)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word'
          }}>
            {entry.content}
          </p>
        </div>
      )}

      {/* Editor */}
      {editing && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>How was your day?</p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 0 }}>
              {MOODS.map(m => (
                <button key={m.id} onClick={() => setMood(m.id)} style={{
                  flex: 1, padding: '12px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: mood === m.id ? 'var(--color-secondary)' : 'var(--color-bg)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  fontWeight: mood === m.id ? 700 : 400, fontSize: 12, color: 'var(--color-text)',
                }}>
                  <span style={{ fontSize: 28 }}>{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write about your day..."
              autoFocus
              style={{
                width: '100%', minHeight: 200, background: 'transparent', border: 'none',
                outline: 'none', fontSize: 15, lineHeight: 1.8, color: 'var(--color-text)',
                resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={save} style={{ flex: 1, fontSize: 16 }}>
              Save entry
            </button>
            {entry && (
              <button className="btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!entry && !editing && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: 40, margin: '0 0 12px' }}>📖</p>
          <p>No entry for this day</p>
          <button className="btn-primary" onClick={() => setEditing(true)} style={{ marginTop: 12 }}>
            Write something
          </button>
        </div>
      )}
    </div>
  );
}
