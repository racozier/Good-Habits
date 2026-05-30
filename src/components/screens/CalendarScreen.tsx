import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../../db';
import { formatShortDate } from '../../utils/dateUtils';
import Modal from '../ui/Modal';
import type { Task } from '../../types';

const TASK_COLORS: Record<string, string> = {
  physical: '#F5A07A', stress: '#D94545', growth: '#5B9EA0', environment: '#C8D5A0', general: '#F7DC8A'
};

const TASK_LABELS: Record<string, string> = {
  physical: 'Physical', stress: 'Important', growth: 'Growth', environment: 'Environment', general: 'General'
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

interface MonthlySummary {
  totalIncome: number;
  totalWorkoutMins: number;
  avgSleepHours: number | null;
  taskColorCounts: Record<string, number>;
  totalTasks: number;
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
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);

  useEffect(() => { loadTasks(); loadMonthlySummary(); }, [year, month]);

  async function loadTasks() {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    const tasks = await db.tasks.where('date').between(start, end, true, true).toArray();
    const grouped: Record<string, Task[]> = {};
    tasks.forEach(t => { (grouped[t.date] ??= []).push(t); });
    setTasksByDate(grouped);
  }

  async function loadMonthlySummary() {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const start = `${monthStr}-01`;
    const end = `${monthStr}-31`;

    const [tasks, workouts, sleep, income] = await Promise.all([
      db.tasks.where('date').between(start, end, true, true).toArray(),
      db.workoutEntries.where('date').between(start, end, true, true).toArray(),
      db.sleepEntries.where('date').between(start, end, true, true).toArray(),
      db.incomeEntries.where('date').between(start, end, true, true).toArray(),
    ]);

    const totalIncome = income.reduce((s, e) => s + e.amount, 0);
    const totalWorkoutMins = workouts.reduce((s, w) => s + w.minutes, 0);
    const avgSleepHours = sleep.length > 0
      ? Math.round((sleep.reduce((s, e) => s + e.durationMinutes, 0) / sleep.length) / 6) / 10
      : null;

    const taskColorCounts: Record<string, number> = {};
    tasks.forEach(t => { taskColorCounts[t.color] = (taskColorCounts[t.color] || 0) + 1; });

    setMonthlySummary({ totalIncome, totalWorkoutMins, avgSleepHours, taskColorCounts, totalTasks: tasks.length });
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
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{TASK_LABELS[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly summary */}
      {monthlySummary && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--color-text)' }}>
            📊 {monthName} Summary
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {monthlySummary.totalIncome > 0 && (
              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--color-text-muted)' }}>💰 Income</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>${monthlySummary.totalIncome.toFixed(2)}</p>
              </div>
            )}
            {monthlySummary.totalWorkoutMins > 0 && (
              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--color-text-muted)' }}>💪 Workout</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>{monthlySummary.totalWorkoutMins} min</p>
              </div>
            )}
            {monthlySummary.avgSleepHours !== null && (
              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--color-text-muted)' }}>😴 Avg Sleep</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>{monthlySummary.avgSleepHours}h</p>
              </div>
            )}
            {monthlySummary.totalTasks > 0 && (
              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--color-text-muted)' }}>✅ Tasks logged</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>{monthlySummary.totalTasks}</p>
              </div>
            )}
          </div>
          {monthlySummary.totalTasks > 0 && Object.keys(monthlySummary.taskColorCounts).length > 0 && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Task breakdown</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(monthlySummary.taskColorCounts)
                  .sort(([,a],[,b]) => b - a)
                  .map(([cat, count]) => {
                    const pct = Math.round((count / monthlySummary.totalTasks) * 100);
                    return (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: TASK_COLORS[cat], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 80 }}>{TASK_LABELS[cat]}</span>
                        <div style={{ flex: 1, height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: TASK_COLORS[cat], borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 36, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Day detail modal */}
      <Modal open={!!selectedDate} onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatShortDate(selectedDate) : ''}>
        {loadingMetrics ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px 0' }}>Loading...</p>
        ) : dayMetrics ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

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

            {dayMetrics.booksCompleted.length > 0 && (
              <div style={{ background: 'var(--color-secondary)', borderRadius: 12, padding: '10px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--color-text-muted)' }}>📚 Books finished</p>
                {dayMetrics.booksCompleted.map(t => (
                  <p key={t} style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>✅ {t}</p>
                ))}
              </div>
            )}

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
