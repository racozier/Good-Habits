import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../../db';
import { uid, formatDate } from '../../utils/dateUtils';
import { useAppStore } from '../../store/appStore';
import type { DiaryEntry, Mood } from '../../types';

const MOODS: { id: Mood; emoji: string; label: string }[] = [
  { id: 'great', emoji: '😊', label: 'Great' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'bad', emoji: '😔', label: 'Rough' },
];

const SECTIONS: { key: keyof DiaryEntry; label: string; placeholder: string }[] = [
  { key: 'content', label: 'Today\'s Entry', placeholder: 'Write about your day...' },
  { key: 's1', label: 'What did I do good today?', placeholder: 'Celebrate your wins...' },
  { key: 's2', label: 'What can I do better?', placeholder: 'Areas to improve...' },
  { key: 's3', label: 'Positives from negatives?', placeholder: 'What good came from challenges...' },
  { key: 's4', label: 'Learning experiences', placeholder: 'What did you learn...' },
  { key: 's5', label: 'Prejudice about money — TRANSFORM', placeholder: 'Reframe your money beliefs...' },
];

function Section({
  label, value, placeholder, open, onToggle, onChange, onSave,
}: {
  label: string; value: string; placeholder: string;
  open: boolean; onToggle: () => void; onChange: (v: string) => void; onSave: () => void;
}) {
  const hasContent = value.trim().length > 0;
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)', textAlign: 'left' }}>
          {label}
          {hasContent && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-primary)' }}>✓</span>}
        </span>
        {open ? <ChevronUp size={18} color="var(--color-text-muted)" /> : <ChevronDown size={18} color="var(--color-text-muted)" />}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={onSave}
            placeholder={placeholder}
            style={{
              width: '100%', minHeight: 120, background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
              borderRadius: 10, padding: '10px 12px', outline: 'none', fontSize: 14,
              lineHeight: 1.7, color: 'var(--color-text)', resize: 'none', fontFamily: 'inherit',
            }}
          />
          <button className="btn-primary" onClick={onSave} style={{ marginTop: 8, fontSize: 13, padding: '8px 20px' }}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

export default function DiaryScreen() {
  const { viewingDate } = useAppStore();
  const date = viewingDate;

  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [mood, setMood] = useState<Mood | undefined>(undefined);
  const [values, setValues] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ content: true });

  useEffect(() => { loadEntry(); }, [date]);

  async function loadEntry() {
    const e = await db.diaryEntries.where('date').equals(date).first();
    if (e) {
      setEntry(e);
      setMood(e.mood);
      const v: Record<string, string> = {};
      SECTIONS.forEach(s => { v[s.key as string] = (e[s.key] as string) || ''; });
      setValues(v);
    } else {
      setEntry(null);
      setMood(undefined);
      const v: Record<string, string> = {};
      SECTIONS.forEach(s => { v[s.key as string] = ''; });
      setValues(v);
    }
  }

  async function saveSection(key: string, value: string) {
    const update = { [key]: value };
    if (entry) {
      await db.diaryEntries.update(entry.id, update);
      setEntry({ ...entry, ...update } as DiaryEntry);
    } else {
      const id = uid();
      const newEntry: DiaryEntry = {
        id, date,
        content: key === 'content' ? value : '',
        mood,
        s1: key === 's1' ? value : undefined,
        s2: key === 's2' ? value : undefined,
        s3: key === 's3' ? value : undefined,
        s4: key === 's4' ? value : undefined,
        s5: key === 's5' ? value : undefined,
      };
      await db.diaryEntries.add(newEntry);
      setEntry(newEntry);
    }
  }

  async function saveMood(m: Mood) {
    setMood(m);
    if (entry) {
      await db.diaryEntries.update(entry.id, { mood: m });
      setEntry({ ...entry, mood: m });
    } else {
      const id = uid();
      const newEntry: DiaryEntry = { id, date, content: '', mood: m };
      await db.diaryEntries.add(newEntry);
      setEntry(newEntry);
    }
  }

  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Diary</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>{formatDate(date)}</p>
      </div>

      {/* Mood */}
      <div className="card" style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>How was your day?</p>
        <div style={{ display: 'flex', gap: 10 }}>
          {MOODS.map(m => (
            <button key={m.id} onClick={() => saveMood(m.id)} style={{
              flex: 1, padding: '10px 6px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: mood === m.id ? 'var(--color-secondary)' : 'var(--color-bg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              fontWeight: mood === m.id ? 700 : 400, fontSize: 12, color: 'var(--color-text)',
            }}>
              <span style={{ fontSize: 26 }}>{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {SECTIONS.map(s => (
        <Section
          key={s.key as string}
          label={s.label}
          value={values[s.key as string] || ''}
          placeholder={s.placeholder}
          open={!!openSections[s.key as string]}
          onToggle={() => toggleSection(s.key as string)}
          onChange={v => setValues(prev => ({ ...prev, [s.key as string]: v }))}
          onSave={() => saveSection(s.key as string, values[s.key as string] || '')}
        />
      ))}
    </div>
  );
}
