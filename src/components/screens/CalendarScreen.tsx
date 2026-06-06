import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, ChevronDown, ChevronUp, BookOpen, X } from 'lucide-react';
import { db } from '../../db';
import { formatShortDate, today, addDays } from '../../utils/dateUtils';
import { useAppStore } from '../../store/appStore';
import Modal from '../ui/Modal';
import { SleepGauge, getSleepZone, SLEEP_COLORS, formatSleepLabel } from '../ui/SleepGauge';
import type { Task, DiaryEntry } from '../../types';

const DIARY_SECTIONS: { key: keyof DiaryEntry; label: string }[] = [
  { key: 'content', label: 'Thoughts' },
  { key: 's1', label: 'What did I do good today?' },
  { key: 's2', label: 'What can I do better?' },
  { key: 's3', label: 'Positives from negatives?' },
  { key: 's4', label: 'Learning experiences' },
  { key: 's5', label: 'Prejudice about money — TRANSFORM' },
];

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
  cleaningMins: number;
  walkMins: number;
  weightKg: number | null;
  sleepMins: number | null;
  diaryMood: string | null;
  diaryEntry: DiaryEntry | null;
  incomeAmount: number;
}

interface MonthlySummary {
  totalWorkoutMins: number;
  totalWalkMins: number;
  avgSleepMins: number | null;
  taskColorCounts: Record<string, number>;
  totalTasks: number;
  totalIncome: number;
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

function calcSleepMins(bedtime: string, wakeTime: string): number {
  const [bH, bM] = bedtime.split(':').map(Number);
  const [wH, wM] = wakeTime.split(':').map(Number);
  let mins = (wH * 60 + wM) - (bH * 60 + bM);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

function DayCell({ date, tasks, isToday, onClick }: { date: string; tasks: Task[]; isToday: boolean; onClick: () => void }) {
  const completed = tasks.filter(t => t.completed);
  const day = parseInt(date.split('-')[2]);
  const colorCounts: Record<string, number> = {};
  completed.forEach(t => { colorCounts[t.color] = (colorCounts[t.color] || 0) + 1; });
  const totalCompleted = completed.length;
  const segments = Object.entries(colorCounts).map(([color, count]) => ({
    color: TASK_COLORS[color],
    pct: totalCompleted > 0 ? (count / totalCompleted) * 100 : 0,
  }));
  const hasScary = tasks.some(t => t.scary && t.completed);

  return (
    <button onClick={onClick} style={{
      aspectRatio: '1', borderRadius: 10, padding: 4,
      border: hasScary ? '2px solid #F5C842' : (isToday ? '2px solid var(--color-primary)' : '1px solid transparent'),
      boxShadow: hasScary ? '0 0 8px 2px rgba(245,200,66,0.5)' : undefined,
      background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 3,
    }}>
      <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: 'var(--color-text)', lineHeight: 1 }}>
        {day}
      </span>
      {totalCompleted > 0 && (
        <div style={{ width: '70%', height: '28%', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
          {segments.map((seg, i) => (
            <div key={i} style={{ width: `${seg.pct}%`, background: seg.color, height: '100%' }} />
          ))}
        </div>
      )}
    </button>
  );
}

export default function CalendarScreen() {
  const { navigate, setViewingDate } = useAppStore();
  const now = new Date();
  const todayStr = today();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tasksByDate, setTasksByDate] = useState<Record<string, Task[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayMetrics, setDayMetrics] = useState<DayMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [diaryViewDate, setDiaryViewDate] = useState<string | null>(null);

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
    const prevMonthLastDay = addDays(start, -1);

    const [tasks, workouts, walks, income, daySettingsArr] = await Promise.all([
      db.tasks.where('date').between(start, end, true, true).toArray(),
      db.workoutEntries.where('date').between(start, end, true, true).toArray(),
      db.walkEntries.where('date').between(start, end, true, true).toArray(),
      db.incomeEntries.where('date').between(start, end, true, true).toArray(),
      // Load from prev month last day to month end to catch bedtime pairs
      db.daySettings.where('date').between(prevMonthLastDay, end, true, true).toArray(),
    ]);

    const totalWorkoutMins = workouts.reduce((s, w) => s + w.minutes, 0);
    const totalWalkMins = walks.reduce((s, w) => s + w.minutes, 0);
    const totalIncome = income.reduce((s, e) => s + e.amount, 0);

    // Build sleep averages from bedtime/wakeTime pairs
    const dsMap: Record<string, { bedtime?: string; wakeTime?: string }> = {};
    daySettingsArr.forEach(ds => { dsMap[ds.date] = ds; });

    const sleepMinsArr: number[] = [];
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      const ds = dsMap[dateStr];
      if (!ds?.wakeTime) continue;
      const prev = dsMap[addDays(dateStr, -1)];
      if (!prev?.bedtime) continue;
      sleepMinsArr.push(calcSleepMins(prev.bedtime, ds.wakeTime));
    }
    const avgSleepMins = sleepMinsArr.length > 0
      ? Math.round(sleepMinsArr.reduce((s, m) => s + m, 0) / sleepMinsArr.length)
      : null;

    const taskColorCounts: Record<string, number> = {};
    tasks.forEach(t => { taskColorCounts[t.color] = (taskColorCounts[t.color] || 0) + 1; });

    setMonthlySummary({ totalWorkoutMins, totalWalkMins, avgSleepMins, taskColorCounts, totalTasks: tasks.length, totalIncome });
  }

  async function openDay(date: string) {
    setSelectedDate(date);
    setLoadingMetrics(true);
    const prevDay = addDays(date, -1);
    const [tasks, water, workouts, cleaning, walks, weights, diary, ds, prevDs, income] = await Promise.all([
      db.tasks.where('date').equals(date).toArray(),
      db.waterEntries.where('date').equals(date).toArray(),
      db.workoutEntries.where('date').equals(date).toArray(),
      db.cleaningEntries.where('date').equals(date).toArray(),
      db.walkEntries.where('date').equals(date).toArray(),
      db.weightEntries.where('date').equals(date).toArray(),
      db.diaryEntries.where('date').equals(date).first(),
      db.daySettings.get(date),
      db.daySettings.get(prevDay),
      db.incomeEntries.where('date').equals(date).toArray(),
    ]);

    // Sleep = prevDay bedtime → this day wakeTime
    let sleepMins: number | null = null;
    if (ds?.wakeTime && prevDs?.bedtime) {
      sleepMins = calcSleepMins(prevDs.bedtime, ds.wakeTime);
    }

    setTasksExpanded(false);
    setDayMetrics({
      date, tasks,
      waterMl: water.reduce((s, w) => s + w.ml, 0),
      workoutMins: workouts.reduce((s, w) => s + w.minutes, 0),
      cleaningMins: cleaning.reduce((s, c) => s + c.minutes, 0),
      walkMins: walks.reduce((s, w) => s + w.minutes, 0),
      weightKg: weights.length > 0 ? weights[weights.length - 1].kg : null,
      sleepMins,
      diaryMood: diary?.mood ?? null,
      diaryEntry: diary ?? null,
      incomeAmount: income.reduce((s, e) => s + e.amount, 0),
    });
    setLoadingMetrics(false);
  }

  function jumpToDay(date: string) {
    setViewingDate(date);
    setSelectedDate(null);
    navigate('tasks');
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  }

  const days = getMonthDays(year, month);
  const monthName = new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const MOOD_EMOJI: Record<string, string> = { great: '😊', okay: '😐', bad: '😔' };

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Calendar</h2>
      </div>

      {/* Calendar grid */}
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
            return <DayCell key={date} date={date} tasks={tasksByDate[date] || []} isToday={date === todayStr} onClick={() => openDay(date)} />;
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="card" style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>Colour legend</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(TASK_COLORS).map(([key, color]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
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

          {/* Sleep odometer */}
          {monthlySummary.avgSleepMins !== null && (() => {
            const zone = getSleepZone(monthlySummary.avgSleepMins);
            const col = SLEEP_COLORS[zone];
            const h = Math.floor(monthlySummary.avgSleepMins / 60);
            const m = monthlySummary.avgSleepMins % 60;
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: col.bg + '50', borderRadius: 14, padding: '12px 16px',
                marginBottom: 14, border: `1.5px solid ${col.bg}`,
              }}>
                <SleepGauge totalMins={monthlySummary.avgSleepMins} size="sm" />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>Average sleep this month</div>
                  <div style={{ fontWeight: 800, fontSize: 20, color: col.text, lineHeight: 1 }}>
                    {h}h{m > 0 ? ` ${m}m` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: col.text, fontWeight: 600, marginTop: 2 }}>
                    {formatSleepLabel(zone)}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Stat grid */}
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
            {monthlySummary.totalWalkMins > 0 && (
              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--color-text-muted)' }}>🚶 Walk</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>{monthlySummary.totalWalkMins} min</p>
              </div>
            )}
            {monthlySummary.totalTasks > 0 && (
              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--color-text-muted)' }}>✅ Tasks</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>{monthlySummary.totalTasks}</p>
              </div>
            )}
          </div>

          {/* Task colour breakdown */}
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
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: TASK_COLORS[cat], flexShrink: 0 }} />
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

            {dayMetrics.date !== todayStr && (
              <button onClick={() => jumpToDay(dayMetrics.date)} style={{
                display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                background: 'var(--color-primary)', color: 'white', border: 'none',
                borderRadius: 12, padding: '12px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              }}>
                <ExternalLink size={16} />
                Jump to Day
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {dayMetrics.diaryMood && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-bg)', borderRadius: 10, padding: '8px 12px' }}>
                  <span style={{ fontSize: 20 }}>{MOOD_EMOJI[dayMetrics.diaryMood]}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Mood</span>
                </div>
              )}
              {dayMetrics.diaryEntry && (
                <button onClick={() => setDiaryViewDate(dayMetrics.date)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--color-bg)', borderRadius: 10, padding: '8px 12px',
                    border: 'none', cursor: 'pointer',
                  }}>
                  <BookOpen size={16} color="var(--color-primary)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>Read Diary</span>
                </button>
              )}
            </div>

            {/* Stats grid — always show weight, water, cleaning; others only if logged */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { icon: '💧', label: 'Water',    value: dayMetrics.waterMl > 0 ? `${dayMetrics.waterMl}ml` : '—', always: false },
                { icon: '⚖️', label: 'Weight',   value: dayMetrics.weightKg ? `${dayMetrics.weightKg} kg` : '—', always: true },
                { icon: '🧹', label: 'Cleaning', value: dayMetrics.cleaningMins >= 20 ? '✓ Done' : '—', always: false },
                {
                  icon: '😴', label: 'Sleep', always: false,
                  value: dayMetrics.sleepMins
                    ? `${Math.floor(dayMetrics.sleepMins / 60)}h${dayMetrics.sleepMins % 60 > 0 ? ` ${dayMetrics.sleepMins % 60}m` : ''}`
                    : '—',
                },
                ...(dayMetrics.workoutMins > 0 ? [{ icon: '💪', label: 'Workout', value: `${dayMetrics.workoutMins} min`, always: false }] : []),
                ...(dayMetrics.walkMins > 0 ? [{ icon: '🚶', label: 'Walk', value: `${dayMetrics.walkMins} min`, always: false }] : []),
                ...(dayMetrics.incomeAmount > 0 ? [{ icon: '💰', label: 'Income', value: `$${dayMetrics.incomeAmount.toFixed(2)}`, always: false }] : []),
              ].filter(s => s.always || s.value !== '—').map(({ icon, label, value }) => (
                <div key={label} style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '10px 12px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--color-text-muted)' }}>{icon} {label}</p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: value === '—' ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Completed tasks — expandable, sorted hardest first */}
            {(() => {
              const completed = dayMetrics.tasks
                .filter(t => t.completed)
                .sort((a, b) => b.difficulty - a.difficulty);
              const total = dayMetrics.tasks.length;
              if (total === 0) return (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No tasks logged</p>
              );
              return (
                <div>
                  <button onClick={() => setTasksExpanded(e => !e)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    marginBottom: tasksExpanded ? 10 : 0,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      ✅ Completed tasks — {completed.length}/{total}
                    </span>
                    {tasksExpanded ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
                  </button>
                  {tasksExpanded && completed.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: TASK_COLORS[t.color] }} />
                      <span style={{ fontSize: 14, flex: 1, color: 'var(--color-text)' }}>{t.text}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{'★'.repeat(t.difficulty)}</span>
                    </div>
                  ))}
                  {tasksExpanded && completed.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>None completed</p>
                  )}
                </div>
              );
            })()}
          </div>
        ) : null}
      </Modal>

      {/* Diary viewer — full-screen read-only overlay */}
      {diaryViewDate && (() => {
        const entry = dayMetrics?.diaryEntry;
        if (!entry) return null;
        const sections = DIARY_SECTIONS.filter(s => entry[s.key] && String(entry[s.key]).trim());
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'var(--color-bg)', overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              position: 'sticky', top: 0, background: 'var(--color-bg)',
              borderBottom: '1px solid var(--color-border)',
              padding: '14px 16px', paddingTop: 'max(env(safe-area-inset-top), 14px)',
              display: 'flex', alignItems: 'center', gap: 12, zIndex: 1,
            }}>
              <button onClick={() => setDiaryViewDate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={22} color="var(--color-text)" />
              </button>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>Diary</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{formatShortDate(diaryViewDate)}</div>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '24px 20px 60px', display: 'flex', flexDirection: 'column', gap: 28 }}>
              {sections.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>No diary entries for this day.</p>
              ) : sections.map(s => (
                <div key={String(s.key)}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>
                    {s.label}
                  </p>
                  <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {String(entry[s.key])}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
