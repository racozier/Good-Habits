import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../../db';
import { today, uid, formatDate } from '../../utils/dateUtils';
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
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadEntry(); setSaved(false); }, [currentDate]);

  async function loadEntry() {
    const e = await db.diaryEntries.where('date').equals(currentDate).first();
    if (e) { setEntry(e); setContent(e.content); setMood(e.mood); }
    else { setEntry(null); setContent(''); setMood(undefined); }
  }

  async function save() {
    if (!content.trim()) return;
    if (entry) {
      await db.diaryEntries.update(entry.id, { content, mood });
    } else {
      await db.diaryEntries.add({ id: uid(), date: currentDate, content, mood });
    }
    setSaved(true);
    loadEntry();
  }

  function prevDay() {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setCurrentDate(d.toISOString().split('T')[0]);
  }

  function nextDay() {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().split('T')[0];
    if (next <= today()) setCurrentDate(next);
  }

  const isToday = currentDate === today();

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Diary</h2>
      </div>

      {/* Date navigation */}
      <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={prevDay} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
          <ChevronLeft size={20} color="var(--color-text)" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
            {isToday ? 'Today' : formatDate(currentDate).split(',')[0]}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>{formatDate(currentDate)}</p>
        </div>
        <button onClick={nextDay} disabled={isToday}
          style={{ background: 'none', border: 'none', cursor: isToday ? 'default' : 'pointer', padding: 8, opacity: isToday ? 0.3 : 1 }}>
          <ChevronRight size={20} color="var(--color-text)" />
        </button>
      </div>

      {/* Mood */}
      <div className="card" style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>How was your day?</p>
        <div style={{ display: 'flex', gap: 12 }}>
          {MOODS.map(m => (
            <button key={m.id} onClick={() => setMood(m.id)} style={{
              flex: 1, padding: '12px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: mood === m.id ? 'var(--color-secondary)' : 'var(--color-bg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              fontWeight: mood === m.id ? 700 : 400, fontSize: 12,
              color: 'var(--color-text)', transition: 'background 0.15s'
            }}>
              <span style={{ fontSize: 28 }}>{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="card" style={{ marginBottom: 12 }}>
        <textarea
          value={content}
          onChange={e => { setContent(e.target.value); setSaved(false); }}
          placeholder="Write about your day, how you felt, what you accomplished..."
          style={{
            width: '100%', minHeight: 200, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 15, lineHeight: 1.7, color: 'var(--color-text)', resize: 'none'
          }}
        />
      </div>

      <button className="btn-primary" onClick={save} style={{ width: '100%', fontSize: 16 }}>
        {saved ? '✓ Saved' : 'Save entry'}
      </button>
    </div>
  );
}
