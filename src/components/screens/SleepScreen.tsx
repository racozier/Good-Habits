import { useState, useEffect } from 'react';
import { Moon, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../../db';
import { today, uid, calcSleepDuration, formatShortDate, addDays } from '../../utils/dateUtils';
import type { SleepEntry, Mood } from '../../types';

const MOODS: { id: Mood; emoji: string; label: string }[] = [
  { id: 'great', emoji: '😴', label: 'Great' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'bad', emoji: '😫', label: 'Poor' },
];

export default function SleepScreen() {
  const [currentDate, setCurrentDate] = useState(today());
  const [bedtime, setBedtime] = useState('22:30');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState<Mood>('okay');
  const [currentEntry, setCurrentEntry] = useState<SleepEntry | null>(null);
  const [history, setHistory] = useState<SleepEntry[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadEntry(); }, [currentDate]);
  useEffect(() => { loadHistory(); }, []);

  async function loadEntry() {
    setSaved(false);
    const e = await db.sleepEntries.where('date').equals(currentDate).first();
    if (e) {
      setCurrentEntry(e); setBedtime(e.bedtime); setWakeTime(e.wakeTime); setQuality(e.quality);
    } else {
      setCurrentEntry(null); setBedtime('22:30'); setWakeTime('07:00'); setQuality('okay');
    }
  }

  async function loadHistory() {
    const all = await db.sleepEntries.toArray();
    setHistory(all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7));
  }

  async function save() {
    const dur = calcSleepDuration(bedtime, wakeTime);
    if (currentEntry) {
      await db.sleepEntries.update(currentEntry.id, { bedtime, wakeTime, quality, durationMinutes: dur });
    } else {
      await db.sleepEntries.add({ id: uid(), date: currentDate, bedtime, wakeTime, quality, durationMinutes: dur });
    }
    setSaved(true);
    loadEntry();
    loadHistory();
  }

  function prevDay() { setCurrentDate(addDays(currentDate, -1)); }
  function nextDay() {
    const next = addDays(currentDate, 1);
    if (next <= today()) setCurrentDate(next);
  }

  const isToday = currentDate === today();
  const previewDuration = calcSleepDuration(bedtime, wakeTime);
  const avgSleep = history.length > 0
    ? Math.round(history.reduce((s, e) => s + e.durationMinutes, 0) / history.length) : 0;

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Moon size={22} color="var(--color-primary)" />
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Sleep Tracker</h2>
      </div>

      {/* Date nav */}
      <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={prevDay} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 10 }}>
          <ChevronLeft size={22} color="var(--color-text)" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
            {isToday ? 'Tonight / Today' : formatShortDate(currentDate)}
          </p>
          {currentEntry && !saved && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-primary)' }}>Entry saved ✓</p>
          )}
          {!currentEntry && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>No entry yet</p>
          )}
        </div>
        <button onClick={nextDay} disabled={isToday}
          style={{ background: 'none', border: 'none', cursor: isToday ? 'default' : 'pointer', padding: 10, opacity: isToday ? 0.3 : 1 }}>
          <ChevronRight size={22} color="var(--color-text)" />
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Bedtime 🌙</label>
            <input type="time" value={bedtime} onChange={e => { setBedtime(e.target.value); setSaved(false); }}
              className="input" style={{ textAlign: 'center', fontSize: 20, fontWeight: 700 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Wake up ☀️</label>
            <input type="time" value={wakeTime} onChange={e => { setWakeTime(e.target.value); setSaved(false); }}
              className="input" style={{ textAlign: 'center', fontSize: 20, fontWeight: 700 }} />
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '16px', background: 'var(--color-bg)', borderRadius: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 36, fontWeight: 800, color: 'var(--color-primary)', margin: 0 }}>
            {Math.floor(previewDuration / 60)}h {previewDuration % 60}m
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>sleep duration</p>
        </div>

        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>Sleep quality</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {MOODS.map(m => (
            <button key={m.id} onClick={() => { setQuality(m.id); setSaved(false); }} style={{
              flex: 1, padding: '12px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: quality === m.id ? 'var(--color-secondary)' : 'var(--color-bg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 13,
              fontWeight: quality === m.id ? 700 : 400, color: 'var(--color-text)',
            }}>
              <span style={{ fontSize: 24 }}>{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>

        <button className="btn-primary" onClick={save} style={{ width: '100%' }}>
          {saved ? '✓ Saved!' : currentEntry ? 'Update entry' : 'Log sleep'}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="card">
          <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>
            Last 7 days · Avg: {Math.floor(avgSleep / 60)}h {avgSleep % 60}m
          </p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
            {history.slice(0, 7).reverse().map(e => {
              const pct = Math.min(e.durationMinutes / (10 * 60), 1);
              const moodColors: Record<Mood, string> = { great: '#4CAF50', okay: '#F7DC8A', bad: '#E88' };
              const isSelected = e.date === currentDate;
              return (
                <button key={e.id} onClick={() => setCurrentDate(e.date)} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0
                }}>
                  <div style={{
                    width: '100%', height: `${pct * 64}px`, background: moodColors[e.quality],
                    borderRadius: '4px 4px 0 0', minHeight: 4,
                    outline: isSelected ? '2px solid var(--color-primary)' : 'none', outlineOffset: 1
                  }} />
                  <span style={{ fontSize: 9, color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: isSelected ? 700 : 400 }}>
                    {formatShortDate(e.date).split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
