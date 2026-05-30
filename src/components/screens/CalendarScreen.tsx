import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../../db';
import { formatShortDate } from '../../utils/dateUtils';
import Modal from '../ui/Modal';
import type { Task } from '../../types';

const TASK_COLORS: Record<string, string> = {
  physical: '#F5A07A', stress: '#E8916A', growth: '#5B9EA0', environment: '#C8D5A0', general: '#F7DC8A'
};

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
  const [dayTasks, setDayTasks] = useState<Task[]>([]);

  useEffect(() => { loadTasks(); }, [year, month]);

  async function loadTasks() {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    const tasks = await db.tasks.where('date').between(start, end, true, true).toArray();
    const grouped: Record<string, Task[]> = {};
    tasks.forEach(t => { (grouped[t.date] ??= []).push(t); });
    setTasksByDate(grouped);
  }

  function openDay(date: string) {
    setSelectedDate(date);
    setDayTasks(tasksByDate[date] || []);
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  }

  const days = getMonthDays(year, month);
  const monthName = new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const today = new Date().toISOString().split('T')[0];

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
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
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
            const isToday = date === today;
            const colors = [...new Set(tasks.map(t => t.color))].slice(0, 3);

            return (
              <button key={date} onClick={() => openDay(date)} style={{
                aspectRatio: '1', borderRadius: 10, border: isToday ? '2px solid var(--color-primary)' : 'none',
                background: total > 0 ? `rgba(232,145,106,${0.1 + pct * 0.5})` : 'var(--color-bg)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: 0, position: 'relative'
              }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: 'var(--color-text)' }}>
                  {parseInt(date.split('-')[2])}
                </span>
                {colors.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                    {colors.map(c => (
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
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10 }}>Color legend</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {Object.entries(TASK_COLORS).map(([key, color]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{key}</span>
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!selectedDate} onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatShortDate(selectedDate) : ''}>
        {dayTasks.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>No tasks logged this day</p>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              {dayTasks.filter(t => t.completed).length} / {dayTasks.length} tasks completed
            </p>
            {dayTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: TASK_COLORS[t.color], flexShrink: 0 }} />
                <span style={{ fontSize: 14, flex: 1, textDecoration: t.completed ? 'line-through' : 'none',
                  color: t.completed ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{t.text}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·{t.difficulty}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
