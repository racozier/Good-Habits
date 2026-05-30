import { useState, useEffect } from 'react';
import { Moon } from 'lucide-react';
import { db } from '../../db';
import { today, uid, calcSleepDuration, formatShortDate } from '../../utils/dateUtils';
import type { SleepEntry, Mood } from '../../types';

const MOODS: { id: Mood; emoji: string; label: string }[] = [
  { id: 'great', emoji: '😴', label: 'Great' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'bad', emoji: '😫', label: 'Poor' },
];

export default function SleepScreen() {
  const [bedtime, setBedtime] = useState('22:30');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState<Mood>('okay');
  const [todayEntry, setTodayEntry] = useState<SleepEntry | null>(null);
  const [history, setHistory] = useState<SleepEntry[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const e = await db.sleepEntries.where('date').equals(today()).first();
    if (e) { setTodayEntry(e); setBedtime(e.bedtime); setWakeTime(e.wakeTime); setQuality(e.quality); }
    const all = await db.sleepEntries.toArray();
    setHistory(all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7));
  }

  async function save() {
    const dur = calcSleepDuration(bedtime, wakeTime);
    if (todayEntry) {
      await db.sleepEntries.update(todayEntry.id, { bedtime, wakeTime, quality, durationMinutes: dur });
    } else {
      await db.sleepEntries.add({ id: uid(), date: today(), bedtime, wakeTime, quality, durationMinutes: dur });
    }
    setSaved(true); loadData();
  }

  const previewDuration = calcSleepDuration(bedtime, wakeTime);
  const avgSleep = history.length > 0
    ? Math.round(history.reduce((s, e) => s + e.durationMinutes, 0) / history.length) : 0;

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Moon size={22} color="var(--color-primary)" />
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Sleep Tracker</h2>
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
          <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-primary)', margin: 0 }}>
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
              fontWeight: quality === m.id ? 700 : 400, color: 'var(--color-text)'
            }}>
              <span style={{ fontSize: 24 }}>{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>

        <button className="btn-primary" onClick={save} style={{ width: '100%' }}>
          {saved ? '✓ Saved' : 'Log sleep'}
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
              const maxH = 10 * 60;
              const pct = Math.min(e.durationMinutes / maxH, 1);
              const moodColors: Record<Mood, string> = { great: '#4CAF50', okay: '#F7DC8A', bad: '#E88' };
              return (
                <div key={e.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: `${pct * 64}px`, background: moodColors[e.quality],
                    borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
                    {formatShortDate(e.date).split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
