import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Mic, MicOff, Trash2, Repeat, ChevronDown, ChevronUp, Check, Sparkles } from 'lucide-react';
import { db } from '../../db';
import { today, uid } from '../../utils/dateUtils';
import { calcTaskProgress } from '../../utils/progress';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import ProgressBar from '../ui/ProgressBar';
import Modal from '../ui/Modal';
import type { Task, RecurringTask, Difficulty, TaskColor, LifeGoal } from '../../types';
import { useAppStore } from '../../store/appStore';

const COLORS: { id: TaskColor; label: string; hex: string }[] = [
  { id: 'physical', label: 'Physical', hex: '#F5A07A' },
  { id: 'stress', label: 'Important', hex: '#D94545' },
  { id: 'growth', label: 'Growth', hex: '#5B9EA0' },
  { id: 'environment', label: 'Environment', hex: '#C8D5A0' },
  { id: 'general', label: 'General', hex: '#F7DC8A' },
];

const DIFF_LABELS: Record<Difficulty, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TasksScreen() {
  const { energyLevel } = useAppStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recurring, setRecurring] = useState<RecurringTask[]>([]);
  const [lifeGoals, setLifeGoals] = useState<LifeGoal[]>([]);
  const [input, setInput] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [color, setColor] = useState<TaskColor>('general');
  const [showRecurring, setShowRecurring] = useState(false);
  const [showLifeGoals, setShowLifeGoals] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pendingRecurTask, setPendingRecurTask] = useState<Task | null>(null);
  const [recurDays, setRecurDays] = useState<number[]>([]);

  const { listening, start, stop } = useSpeechToText((text) => setInput(prev => prev + text));

  useEffect(() => { loadTasks(); loadRecurring(); loadLifeGoals(); }, []);

  async function loadTasks() {
    const t = await db.tasks.where('date').equals(today()).toArray();
    setTasks(t.sort((a, b) => a.createdAt - b.createdAt));
  }

  async function loadRecurring() {
    const r = await db.recurringTasks.toArray();
    setRecurring(r);
  }

  async function loadLifeGoals() {
    const g = await db.lifeGoals.toArray();
    setLifeGoals(g);
  }

  async function addTask(overrideText?: string, overrideDiff?: Difficulty, overrideColor?: TaskColor) {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    const task: Task = {
      id: uid(), text, difficulty: overrideDiff ?? difficulty, color: overrideColor ?? color,
      completed: false, isRecurring: false, date: today(), createdAt: Date.now()
    };
    await db.tasks.add(task);
    if (!overrideText) setInput('');
    loadTasks();
  }

  async function toggleTask(id: string, completed: boolean) {
    await db.tasks.update(id, { completed });
    loadTasks();
  }

  async function deleteTask(id: string) {
    await db.tasks.delete(id);
    loadTasks();
  }

  function openRecurringPicker(task: Task) {
    setPendingRecurTask(task);
    setRecurDays([]);
  }

  async function saveRecurring() {
    if (!pendingRecurTask) return;
    const rt: RecurringTask = {
      id: uid(),
      text: pendingRecurTask.text,
      difficulty: pendingRecurTask.difficulty,
      color: pendingRecurTask.color,
      days: recurDays,
    };
    await db.recurringTasks.add(rt);
    setPendingRecurTask(null);
    setRecurDays([]);
    loadRecurring();
  }

  async function addRecurringToToday(rt: RecurringTask) {
    const exists = tasks.find(t => t.text === rt.text && t.date === today());
    if (exists) return;
    const task: Task = {
      id: uid(), text: rt.text, difficulty: rt.difficulty, color: rt.color,
      completed: false, isRecurring: true, date: today(), createdAt: Date.now()
    };
    await db.tasks.add(task);
    loadTasks();
  }

  async function deleteRecurring(id: string) {
    await db.recurringTasks.delete(id);
    loadRecurring();
  }

  function toggleRecurDay(day: number) {
    setRecurDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  }

  const todayDow = new Date().getDay();
  const maxDiff3 = energyLevel <= 4 ? 1 : energyLevel <= 7 ? 2 : 3;
  const currentDiff3Count = tasks.filter(t => t.difficulty === 3 && !t.completed).length;
  const progress = calcTaskProgress(tasks);
  const regularTasks = tasks.filter(t => !t.isRecurring);
  const recurringTasksToday = tasks.filter(t => t.isRecurring);

  const todayRecurring = recurring.filter(rt => rt.days.length === 0 || rt.days.includes(todayDow));
  const otherRecurring = recurring.filter(rt => rt.days.length > 0 && !rt.days.includes(todayDow));

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button onClick={() => setEditMode(e => !e)} className="btn-ghost" style={{ fontSize: 13, padding: '6px 12px' }}>
          {editMode ? 'Done' : 'Edit'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <ProgressBar value={progress} label="Task progress" />
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, marginBottom: 0 }}>
          Energy {energyLevel}/10 · Max {maxDiff3} hard task{maxDiff3 !== 1 ? 's' : ''} today
        </p>
      </div>

      {/* Add task */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="input"
            placeholder="Add a task..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            style={{ flex: 1 }}
          />
          <button
            onClick={listening ? stop : start}
            style={{
              background: listening ? 'var(--color-primary)' : 'var(--color-bg)',
              border: '1.5px solid var(--color-border)', borderRadius: 12,
              padding: '0 14px', cursor: 'pointer', flexShrink: 0
            }}
          >
            {listening ? <MicOff size={20} color="white" /> : <Mic size={20} color="var(--color-primary)" />}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {([1, 2, 3] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDifficulty(d)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: difficulty === d ? 700 : 400,
              background: difficulty === d ? 'var(--color-primary)' : 'var(--color-bg)',
              color: difficulty === d ? 'white' : 'var(--color-text)',
              opacity: d === 3 && currentDiff3Count >= maxDiff3 ? 0.5 : 1
            }}>
              {d} · {DIFF_LABELS[d]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {COLORS.map(c => (
            <button key={c.id} onClick={() => setColor(c.id)} title={c.label} style={{
              width: 28, height: 28, borderRadius: '50%',
              border: color === c.id ? '3px solid var(--color-text)' : '2px solid transparent',
              background: c.hex, cursor: 'pointer', flexShrink: 0
            }} />
          ))}
        </div>

        <button className="btn-primary" onClick={() => addTask()} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={18} /> Add Task
        </button>
      </div>

      {/* Life goals quick-pick */}
      <div className="card" style={{ marginBottom: 12 }}>
        <button onClick={() => setShowLifeGoals(s => !s)} style={{
          background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          gap: 8, color: 'var(--color-text)', fontWeight: 600, fontSize: 15, width: '100%', padding: 0
        }}>
          <Sparkles size={16} color="var(--color-primary)" />
          Quick-add from goals
          {showLifeGoals ? <ChevronUp size={16} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={16} style={{ marginLeft: 'auto' }} />}
        </button>
        <AnimatePresence>
          {showLifeGoals && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}>
              <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lifeGoals.map(g => {
                  const colorHex = COLORS.find(c => c.id === g.category)?.hex || '#ccc';
                  const alreadyAdded = tasks.some(t => t.text === g.text && t.date === today());
                  return (
                    <button key={g.id} onClick={() => !alreadyAdded && addTask(g.text, g.difficulty, g.category)}
                      disabled={alreadyAdded}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 12,
                        border: '1.5px solid var(--color-border)',
                        background: alreadyAdded ? 'var(--color-bg)' : 'var(--color-surface)',
                        cursor: alreadyAdded ? 'default' : 'pointer',
                        opacity: alreadyAdded ? 0.5 : 1, textAlign: 'left',
                      }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: colorHex, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 14, color: 'var(--color-text)' }}>{g.text}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·{g.difficulty}</span>
                      {alreadyAdded && <Check size={14} color="green" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recurring panel */}
      {editMode && recurring.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <button onClick={() => setShowRecurring(r => !r)} style={{
            background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            gap: 8, color: 'var(--color-text)', fontWeight: 600, fontSize: 15, width: '100%', padding: 0
          }}>
            <Repeat size={16} color="var(--color-muted)" />
            Recurring Tasks
            {showRecurring ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <AnimatePresence>
            {showRecurring && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}>
                {todayRecurring.length > 0 && (
                  <div style={{ paddingTop: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 600 }}>TODAY</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {todayRecurring.map(rt => <RecurChip key={rt.id} rt={rt} onAdd={() => addRecurringToToday(rt)} onDelete={() => deleteRecurring(rt.id)} added={!!tasks.find(t => t.text === rt.text)} />)}
                    </div>
                  </div>
                )}
                {otherRecurring.length > 0 && (
                  <div style={{ paddingTop: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 600 }}>OTHER DAYS</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {otherRecurring.map(rt => <RecurChip key={rt.id} rt={rt} onAdd={() => addRecurringToToday(rt)} onDelete={() => deleteRecurring(rt.id)} added={!!tasks.find(t => t.text === rt.text)} />)}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <TaskList title="Today's Tasks" tasks={regularTasks} onToggle={toggleTask} onDelete={deleteTask} onMakeRecurring={openRecurringPicker} editMode={editMode} />
      {recurringTasksToday.length > 0 && (
        <TaskList title="Recurring" tasks={recurringTasksToday} onToggle={toggleTask} onDelete={deleteTask} onMakeRecurring={openRecurringPicker} editMode={editMode} />
      )}

      {/* Day picker for making a task recurring */}
      <Modal open={!!pendingRecurTask} onClose={() => setPendingRecurTask(null)} title="Set recurring days">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          "{pendingRecurTask?.text}"<br />
          Select which days this repeats. Leave all unselected = every day.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {DAY_LABELS.map((label, i) => (
            <button key={i} onClick={() => toggleRecurDay(i)} style={{
              padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14,
              fontWeight: recurDays.includes(i) ? 700 : 400,
              background: recurDays.includes(i) ? 'var(--color-primary)' : 'var(--color-bg)',
              color: recurDays.includes(i) ? 'white' : 'var(--color-text)',
            }}>
              {label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          {recurDays.length === 0 ? 'Repeats every day' : `Repeats on: ${recurDays.sort().map(d => DAY_LABELS[d]).join(', ')}`}
        </p>
        <button className="btn-primary" onClick={saveRecurring} style={{ width: '100%' }}>
          Save as recurring
        </button>
      </Modal>
    </div>
  );
}

function RecurChip({ rt, onAdd, onDelete, added }: { rt: RecurringTask; onAdd: () => void; onDelete: () => void; added: boolean }) {
  const colorHex = COLORS.find(c => c.id === rt.color)?.hex || '#ccc';
  const dayStr = rt.days.length === 0 ? 'every day' : rt.days.map(d => DAY_LABELS[d]).join(', ');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-bg)',
      borderRadius: 20, padding: '6px 12px', border: '1.5px solid var(--color-border)',
      opacity: added ? 0.6 : 1,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colorHex, flexShrink: 0 }} />
      <div>
        <button onClick={onAdd} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text)', padding: 0, display: 'block', textAlign: 'left' }}>
          {rt.text} <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>·{rt.difficulty}</span>
        </button>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{dayStr}</span>
      </div>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <Trash2 size={13} color="var(--color-text-muted)" />
      </button>
    </div>
  );
}

function TaskList({ title, tasks, onToggle, onDelete, onMakeRecurring, editMode }: {
  title: string; tasks: Task[];
  onToggle: (id: string, c: boolean) => void;
  onDelete: (id: string) => void;
  onMakeRecurring: (t: Task) => void;
  editMode: boolean;
}) {
  const incomplete = tasks.filter(t => !t.completed);
  const complete = tasks.filter(t => t.completed);
  if (tasks.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, paddingLeft: 4 }}>{title}</p>
      <AnimatePresence>
        {[...incomplete, ...complete].map(task => (
          <motion.div key={task.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: 'var(--color-surface)', borderRadius: 14, marginBottom: 8,
              opacity: task.completed ? 0.6 : 1, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
            }}>
            <button onClick={() => onToggle(task.id, !task.completed)} style={{
              width: 26, height: 26, borderRadius: '50%', border: '2px solid var(--color-primary)',
              background: task.completed ? 'var(--color-primary)' : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              {task.completed && <Check size={14} color="white" strokeWidth={3} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--color-text)',
                textDecoration: task.completed ? 'line-through' : 'none',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {task.text}
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.find(c => c.id === task.color)?.hex || '#ccc' }} />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {DIFF_LABELS[task.difficulty]} · {task.difficulty}pt
                </span>
              </div>
            </div>
            {editMode && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onMakeRecurring(task)} title="Make recurring"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Repeat size={16} color="var(--color-muted)" />
                </button>
                <button onClick={() => onDelete(task.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Trash2 size={16} color="#E88" />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
