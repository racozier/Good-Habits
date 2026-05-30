import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../../db';
import { formatShortDate, addDays } from '../../utils/dateUtils';
import Modal from '../ui/Modal';
import type { Task } from '../../types';

const TASK_COLORS: Record<string, string> = {
  physical: '#F5A07A', stress: '#E8916A', growth: '#5B9EA0', environment: '#C8D5A0', general: '#F7DC8A'
};

interface DayMetrics {
  date: string;
  tasks: Task[];
  waterMl: number;
  workoutMins: number;
  readingMins: number;
  cleaningMins: number;
  booksCompleted: string[];
  sleepDuration: number | null;
  sleepQuality: string | null;
  diaryMood: string | null;
}

function getMonthDays(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const days: (string | null)[] = Array(first === 0 ? 6 : first - 1).fill(null);
  for (let d = 1; d <= total; d++) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

export default function CalendarScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tasksByDate, setTasksByDate] = useState<Record<string, Task[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayMetrics, setDayMetrics] = useState<DayMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => { loadTasks(); }, [year, month]);

  async function loadTasks() {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    const tasks = await db.tasks.where('date').between(start, end, true, true).toArray();
    const grouped: Record<string, Task[]> = {};
    tasks.forEach(t => { (grouped[t.date] ??= []).push(t); });
    setTasksByDate(grouped);
  }

  async function openDay(date: string) {
    setSelectedDate(date);
    setLoadingMetrics(true);
    const [tasks, water, workouts, readings, cleaning, booksAll, sleep, diary] = await Promise.all([
      db.tasks.where('date').equals(date).toArray(),
      db.waterEntries.where('date').equals(date).toArray(),
      db.workoutEntries.where('date').equals(date).toArray(),
      db.readingEntries.where('date').equals(date).toArray(),
      db.cleaningEntries.where('date').equals(date).toArray(),
      db.books.toArray(),
      db.sleepEntries.where('date').equals(date).first(),
      db.diaryEntries.where('date').equals(date).first(),
    ]);

    // Books completed on this date (we approximate by checking tasks with "finished" pattern)
    // Actually let's check books whose completion date is this date - we don't store that,
    // so we check reading entries with bookId and the book is completed
    const readBookIds = [...new Set(readings.filter(r => r.bookId).map(r => r.bookId!))];
    const completedBooks = booksAll
      .filter(b => b.completed && readBookIds.includes(b.id))
      .map(b => b.title);

    setDayMetrics({
      date,
      tasks,
      waterMl: water.reduce((s, w) => s + w.ml, 0),
      workoutMins: workouts.reduce((s, w) => s + w.minutes, 0),
      readingMins: readings.reduce((s, r) => s + r.minutes, 0),
      cleaningMins: cleaning.reduce((s, c) => s + c.minutes, 0),
      booksCompleted: completedBooks,
      sleepDuration: sleep?.durationMinutes ?? null,
      sleepQuality: sleep?.quality ?? null,
      diaryMood: diary?.mood ?? null,
    });
    setLoadingMetrics(false);
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  }

  const days = getMonthDays(year, month);
  const monthName = new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  const MOOD_EMOJI: Record<string, string> = { great: '😊', okay: '😐', bad: '😔' };
  const QUALITY_EMOJI: Record<string, string> = { great: '😴', okay: '😐', bad: '😫' };

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Calendar</h2>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            <ChevronLeft size={20} color="var(--color-text)" />
          </button>
          <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>{monthName}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            <ChevronRight size={20} color="var(--color-text)" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', paddingBottom: 4 }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {days.map((date, i) => {
            if (!date) return <div key={i} />;
            const tasks = tasksByDate[date] || [];
            const done = tasks.filter(t => t.completed).length;
            const total = tasks.length;
            const pct = total > 0 ? done / total : 0;
            const isToday = date === todayStr;
            const colorDots = [...new Set(tasks.map(t => t.color))].slice(0, 3);
            return (
              <button key={date} onClick={() => openDay(date)} style={{
                aspectRatio: '1', borderRadius: 10, padding: 0,
                border: isToday ? '2px solid var(--color-primary)' : 'none',
                background: total > 0 ? `rgba(232,145,106,${0.08 + pct * 0.45})` : 'var(--color-bg)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: 'var(--color-text)' }}>
                  {parseInt(date.split('-')[2])}
                </span>
                {colorDots.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                    {colorDots.map(c => (
                      <div key={c} style={{ width: 5, height: 5, borderRadius: '50%', background: TASK_COLORS[c] }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="card" style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>Colour legend</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(TASK_COLORS).map(([key, color]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day detail modal */}
      <Modal open={!!selectedDate} onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatShortDate(selectedDate) : ''}>
        {loadingMetrics ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px 0' }}>Loading...</p>
        ) : dayMetrics ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Mood row */}
            {(dayMetrics.diaryMood || dayMetrics.sleepQuality) && (
              <div style={{ display: 'flex', gap: 12 }}>
                {dayMetrics.diaryMood && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-bg)', borderRadius: 10, padding: '8px 12px' }}>
                    <span style={{ fontSize: 20 }}>{MOOD_EMOJI[dayMetrics.diaryMood]}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Mood</span>
                  </div>
                )}
                {dayMetrics.sleepQuality && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-bg)', borderRadius: 10, padding: '8px 12px' }}>
                    <span style={{ fontSize: 20 }}>{QUALITY_EMOJI[dayMetrics.sleepQuality]}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      Sleep {dayMetrics.sleepDuration ? `${Math.floor(dayMetrics.sleepDuration / 60)}h ${dayMetrics.sleepDuration % 60}m` : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Health metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { icon: '💧', label: 'Water', value: dayMetrics.waterMl > 0 ? `${dayMetrics.waterMl}ml` : '—' },
                { icon: '💪', label: 'Workout', value: dayMetrics.workoutMins > 0 ? `${dayMetrics.workoutMins} min` : '—' },
                { icon: '📖', label: 'Reading', value: dayMetrics.readingMins > 0 ? `${dayMetrics.readingMins} min` : '—' },
                { icon: '🧹', label: 'Cleaning', value: dayMetrics.cleaningMins >= 20 ? '✓ Done' : '—' },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '10px 12px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--color-text-muted)' }}>{icon} {label}</p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: value === '—' ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Book completions */}
            {dayMetrics.booksCompleted.length > 0 && (
              <div style={{ background: 'var(--color-secondary)', borderRadius: 12, padding: '10px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--color-text-muted)' }}>📚 Books finished</p>
                {dayMetrics.booksCompleted.map(t => (
                  <p key={t} style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>✅ {t}</p>
                ))}
              </div>
            )}

            {/* Tasks */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Tasks — {dayMetrics.tasks.filter(t => t.completed).length}/{dayMetrics.tasks.length} completed
              </p>
              {dayMetrics.tasks.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No tasks logged</p>
              )}
              {dayMetrics.tasks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: TASK_COLORS[t.color] }} />
                  <span style={{
                    fontSize: 14, flex: 1,
                    textDecoration: t.completed ? 'line-through' : 'none',
                    color: t.completed ? 'var(--color-text-muted)' : 'var(--color-text)'
                  }}>{t.text}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>·{t.difficulty}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
