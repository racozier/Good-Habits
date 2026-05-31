import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Mic, MicOff, Trash2, Repeat, ChevronDown, ChevronUp, Check, Sparkles, Skull, AlertTriangle } from 'lucide-react';
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

function getScaryDaysAvoided(task: Task): number {
  const addedDate = task.scaryAddedDate || task.date;
  const todayStr = today();
  const [sy, sm, sd] = addedDate.split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const addedMs = new Date(sy, sm - 1, sd).getTime();
  const todayMs = new Date(ty, tm - 1, td).getTime();
  return Math.max(0, Math.floor((todayMs - addedMs) / 86400000));
}

function getScaryDominance(daysAvoided: number): number {
  return Math.min((daysAvoided + 1) * 20, 100);
}

export default function TasksScreen() {
  const { energyLevel, viewingDate } = useAppStore();
  const date = viewingDate;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recurring, setRecurring] = useState<RecurringTask[]>([]);
  const [lifeGoals, setLifeGoals] = useState<LifeGoal[]>([]);
  const [input, setInput] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [color, setColor] = useState<TaskColor>('general');
  const [showRecurring, setShowRecurring] = useState(false);
  const [showLifeGoals, setShowLifeGoals] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalText, setNewGoalText] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState<TaskColor>('general');
  const [newGoalDiff, setNewGoalDiff] = useState<Difficulty>(1);
  const [pendingRecurTask, setPendingRecurTask] = useState<Task | null>(null);
  const [recurDays, setRecurDays] = useState<number[]>([]);
  const [scaryReward, setScaryReward] = useState<{ taskText: string } | null>(null);

  const { listening, start, stop } = useSpeechToText((text) => setInput(prev => prev + text));

  useEffect(() => { loadAll(); }, [date]);

  async function loadAll() {
    const t = await db.tasks.where('date').equals(date).toArray();
    setTasks(t.sort((a, b) => a.createdAt - b.createdAt));
    const r = await db.recurringTasks.toArray();
    setRecurring(r);
    const g = await db.lifeGoals.toArray();
    setLifeGoals(g);
  }

  async function addTask(overrideText?: string, overrideDiff?: Difficulty, overrideColor?: TaskColor) {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    const task: Task = {
      id: uid(), text, difficulty: overrideDiff ?? difficulty, color: overrideColor ?? color,
      completed: false, isRecurring: false, date, createdAt: Date.now()
    };
    await db.tasks.add(task);
    if (!overrideText) setInput('');
    loadAll();
  }

  async function toggleTask(id: string, completed: boolean) {
    const task = tasks.find(t => t.id === id);
    await db.tasks.update(id, { completed });
    // Scary task completed → show special reward prompt
    if (task?.scary && completed) {
      setScaryReward({ taskText: task.text });
    }
    loadAll();
  }

  async function deleteTask(id: string) {
    await db.tasks.delete(id);
    loadAll();
  }

  async function toggleScary(task: Task) {
    if (!task.scary) {
      await db.tasks.update(task.id, { scary: true, scaryAddedDate: today() });
    } else {
      await db.tasks.update(task.id, { scary: false, scaryAddedDate: undefined });
    }
    loadAll();
  }

  async function addLifeGoal() {
    if (!newGoalText.trim()) return;
    const goal: LifeGoal = {
      id: uid(), text: newGoalText.trim(),
      category: newGoalCategory, difficulty: newGoalDiff, isCustom: true
    };
    await db.lifeGoals.add(goal);
    setNewGoalText('');
    setShowAddGoal(false);
    loadAll();
  }

  async function deleteLifeGoal(id: string) {
    await db.lifeGoals.delete(id);
    loadAll();
  }

  function openRecurringPicker(task: Task) {
    setPendingRecurTask(task);
    setRecurDays([]);
  }

  async function saveRecurring() {
    if (!pendingRecurTask) return;
    await db.recurringTasks.add({
      id: uid(), text: pendingRecurTask.text,
      difficulty: pendingRecurTask.difficulty, color: pendingRecurTask.color, days: recurDays,
    });
    setPendingRecurTask(null); setRecurDays([]);
    loadAll();
  }

  async function addRecurringToToday(rt: RecurringTask) {
    const exists = tasks.find(t => t.text === rt.text && t.date === date);
    if (exists) return;
    await db.tasks.add({
      id: uid(), text: rt.text, difficulty: rt.difficulty, color: rt.color,
      completed: false, isRecurring: true, date, createdAt: Date.now()
    });
    loadAll();
  }

  async function deleteRecurring(id: string) {
    await db.recurringTasks.delete(id);
    loadAll();
  }

  const todayDow = new Date().getDay();
  const maxDiff3 = energyLevel <= 4 ? 1 : energyLevel <= 7 ? 2 : 3;
  const progress = calcTaskProgress(tasks);

  // Sort: scary (incomplete) > missed > regular
  const scaryIncompleteTasks = tasks.filter(t => t.scary && !t.completed);
  const scaryCompletedTasks = tasks.filter(t => t.scary && t.completed);
  const missedTasks = tasks.filter(t => !t.scary && t.missed && !t.completed);
  const missedCompleted = tasks.filter(t => !t.scary && t.missed && t.completed);
  const regularTasks = tasks.filter(t => !t.scary && !t.missed && !t.isRecurring);
  const recurringTasksToday = tasks.filter(t => !t.scary && t.isRecurring);

  const todayRecurring = recurring.filter(rt => rt.days.length === 0 || rt.days.includes(todayDow));
  const otherRecurring = recurring.filter(rt => rt.days.length > 0 && !rt.days.includes(todayDow));

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>

      <div className="card" style={{ marginTop: 16, marginBottom: 12 }}>
        <ProgressBar value={progress} label="Task progress" />
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, marginBottom: 0 }}>
          Energy {energyLevel}/10 · Max {maxDiff3} hard task{maxDiff3 !== 1 ? 's' : ''} today
        </p>
      </div>

      {/* Add task */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input className="input" placeholder="Add a task..." value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            style={{ flex: 1 }} />
          <button onClick={listening ? stop : start} style={{
            background: listening ? 'var(--color-primary)' : 'var(--color-bg)',
            border: '1.5px solid var(--color-border)', borderRadius: 12,
            padding: '0 14px', cursor: 'pointer', flexShrink: 0
          }}>
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
                  const alreadyAdded = tasks.some(t => t.text === g.text && t.date === date);
                  return (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => !alreadyAdded && addTask(g.text, g.difficulty, g.category)}
                        disabled={alreadyAdded}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 12,
                          border: '1.5px solid var(--color-border)',
                          background: alreadyAdded ? 'var(--color-bg)' : 'var(--color-surface)',
                          cursor: alreadyAdded ? 'default' : 'pointer',
                          opacity: alreadyAdded ? 0.5 : 1, textAlign: 'left',
                        }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: colorHex, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)' }}>{g.text}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·{g.difficulty}</span>
                        {alreadyAdded && <Check size={13} color="green" />}
                      </button>
                      <button onClick={() => deleteLifeGoal(g.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0
                      }}>
                        <Trash2 size={14} color="var(--color-text-muted)" />
                      </button>
                    </div>
                  );
                })}

                {/* Add custom goal */}
                {showAddGoal ? (
                  <div style={{ marginTop: 6, padding: '12px', background: 'var(--color-bg)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="input" placeholder="Goal text..." value={newGoalText}
                      onChange={e => setNewGoalText(e.target.value)} style={{ fontSize: 13 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {COLORS.map(c => (
                        <button key={c.id} onClick={() => setNewGoalCategory(c.id)} title={c.label} style={{
                          width: 24, height: 24, borderRadius: '50%', background: c.hex, border: 'none', cursor: 'pointer',
                          outline: newGoalCategory === c.id ? '2px solid var(--color-text)' : '2px solid transparent', outlineOffset: 2
                        }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([1, 2, 3] as Difficulty[]).map(d => (
                        <button key={d} onClick={() => setNewGoalDiff(d)} style={{
                          flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                          background: newGoalDiff === d ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: newGoalDiff === d ? 'white' : 'var(--color-text)', fontWeight: newGoalDiff === d ? 700 : 400
                        }}>{DIFF_LABELS[d]}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-primary" onClick={addLifeGoal} style={{ flex: 1, padding: '8px', fontSize: 13 }}>Add</button>
                      <button className="btn-ghost" onClick={() => setShowAddGoal(false)} style={{ fontSize: 13 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddGoal(true)} style={{
                    marginTop: 4, display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: '1.5px dashed var(--color-border)', borderRadius: 10,
                    padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)', fontWeight: 600
                  }}>
                    <Plus size={14} /> Add custom goal
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recurring panel */}
      {recurring.length > 0 && (
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

      {/* Scary tasks */}
      {(scaryIncompleteTasks.length > 0 || scaryCompletedTasks.length > 0) && (
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#B8860B', marginBottom: 8, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            ⚡ Scary Tasks
          </p>
          {[...scaryIncompleteTasks, ...scaryCompletedTasks].map(task => (
            <ScaryTaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onToggleScary={toggleScary} />
          ))}
        </div>
      )}

      {/* Missed tasks */}
      {(missedTasks.length > 0 || missedCompleted.length > 0) && (
        <TaskList title="⏰ Carried Over" tasks={[...missedTasks, ...missedCompleted]}
          onToggle={toggleTask} onDelete={deleteTask} onMakeRecurring={openRecurringPicker} onToggleScary={toggleScary} />
      )}

      {/* Today's tasks */}
      <TaskList title="Today's Tasks" tasks={regularTasks}
        onToggle={toggleTask} onDelete={deleteTask} onMakeRecurring={openRecurringPicker} onToggleScary={toggleScary} />

      {recurringTasksToday.length > 0 && (
        <TaskList title="Recurring" tasks={recurringTasksToday}
          onToggle={toggleTask} onDelete={deleteTask} onMakeRecurring={openRecurringPicker} onToggleScary={toggleScary} />
      )}

      {/* Day picker modal */}
      <Modal open={!!pendingRecurTask} onClose={() => setPendingRecurTask(null)} title="Set recurring days">
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          "{pendingRecurTask?.text}"<br />Leave all unselected = every day.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {DAY_LABELS.map((label, i) => (
            <button key={i} onClick={() => setRecurDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])} style={{
              padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14,
              fontWeight: recurDays.includes(i) ? 700 : 400,
              background: recurDays.includes(i) ? 'var(--color-primary)' : 'var(--color-bg)',
              color: recurDays.includes(i) ? 'white' : 'var(--color-text)',
            }}>{label}</button>
          ))}
        </div>
        <button className="btn-primary" onClick={saveRecurring} style={{ width: '100%' }}>Save as recurring</button>
      </Modal>

      {/* Scary task completed reward prompt */}
      <Modal open={!!scaryReward} onClose={() => setScaryReward(null)} title="⭐ Scary Task Done!">
        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏆</div>
          <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)', margin: '0 0 8px' }}>
            You conquered it!
          </p>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
            "{scaryReward?.taskText}"<br />
            You've earned a minimum 1.5 hour reward. You deserve it!
          </p>
          <button className="btn-primary" onClick={() => setScaryReward(null)} style={{ width: '100%', fontSize: 16 }}>
            Claim 1.5h+ Reward 🎉
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ScaryTaskItem({ task, onToggle, onDelete, onToggleScary }: {
  task: Task;
  onToggle: (id: string, c: boolean) => void;
  onDelete: (id: string) => void;
  onToggleScary: (t: Task) => void;
}) {
  const days = getScaryDaysAvoided(task);
  const dominance = getScaryDominance(days);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={task.completed ? undefined : 'scary-task'}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 14px',
        background: 'var(--color-surface)', borderRadius: 16, marginBottom: 10,
        opacity: task.completed ? 0.6 : 1,
        transform: 'scale(1.02)',
      }}
    >
      <button onClick={() => onToggle(task.id, !task.completed)} style={{
        width: 28, height: 28, borderRadius: '50%', border: '2px solid #F5C040',
        background: task.completed ? '#F5C040' : 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1
      }}>
        {task.completed && <Check size={14} color="white" strokeWidth={3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)',
          textDecoration: task.completed ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.text}
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#B8860B', fontWeight: 700 }}>
            ⚡ Day {days + 1} · {dominance}% of bar
          </span>
          {task.missed && <span style={{ fontSize: 10, background: '#E88', color: 'white', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>MISSED</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onToggleScary(task)} title="Remove scary" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Skull size={14} color="#B8860B" />
        </button>
        <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Trash2 size={14} color="#E88" />
        </button>
      </div>
    </motion.div>
  );
}

function TaskList({ title, tasks, onToggle, onDelete, onMakeRecurring, onToggleScary }: {
  title: string; tasks: Task[];
  onToggle: (id: string, c: boolean) => void;
  onDelete: (id: string) => void;
  onMakeRecurring: (t: Task) => void;
  onToggleScary: (t: Task) => void;
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
                {task.missed && <span style={{ fontSize: 10, background: '#E88', color: 'white', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>MISSED</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => onToggleScary(task)} title={task.scary ? 'Remove scary' : 'Mark scary'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <AlertTriangle size={15} color={task.scary ? '#F5C040' : 'var(--color-border)'} />
              </button>
              <button onClick={() => onMakeRecurring(task)} title="Make recurring" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <Repeat size={15} color="var(--color-border)" />
              </button>
              <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <Trash2 size={15} color="#E88" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
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
        <button onClick={onAdd} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text)', padding: 0 }}>
          {rt.text} <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>·{rt.difficulty}</span>
        </button>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'block' }}>{dayStr}</span>
      </div>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <Trash2 size={13} color="var(--color-text-muted)" />
      </button>
    </div>
  );
}
