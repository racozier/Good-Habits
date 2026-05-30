import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Dumbbell, BookOpen, Sparkles, Trash2, Plus, Check } from 'lucide-react';
import { db } from '../../db';
import { today, uid, getWeekStart } from '../../utils/dateUtils';
import { calcHealthProgress, calcEnvironmentProgress } from '../../utils/progress';
import ProgressBar from '../ui/ProgressBar';
import CountdownTimer from '../ui/CountdownTimer';
import Modal from '../ui/Modal';
import type { WaterEntry, WorkoutEntry, ReadingEntry, CleaningEntry, FinancialTask } from '../../types';

export default function HealthScreen() {
  const date = today();
  const weekStart = getWeekStart(date);

  const [waterMl, setWaterMl] = useState(0);
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutEntry[]>([]);
  const [weeklyWorkout, setWeeklyWorkout] = useState(0);
  const [workoutGoal, setWorkoutGoal] = useState(60);
  const [timesReached, setTimesReached] = useState(0);
  const [todayReadingMins, setTodayReadingMins] = useState(0);
  const [cleaningMins, setCleaningMins] = useState(0);
  const [financialTasks, setFinancialTasks] = useState<FinancialTask[]>([]);
  const [showWorkoutInput, setShowWorkoutInput] = useState(false);
  const [workoutMins, setWorkoutMins] = useState('');
  const [showReadingTimer, setShowReadingTimer] = useState(false);
  const [showFinAdd, setShowFinAdd] = useState(false);
  const [finInput, setFinInput] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const water = await db.waterEntries.where('date').equals(date).toArray();
    setWaterMl(water.reduce((s, w) => s + w.ml, 0));

    const workouts = await db.workoutEntries.where('weekStart').equals(weekStart).toArray();
    setWorkoutEntries(workouts);
    setWeeklyWorkout(workouts.reduce((s, w) => s + w.minutes, 0));

    const goal = await db.workoutGoal.get('goal');
    if (goal) { setWorkoutGoal(goal.weeklyMinutes); setTimesReached(goal.timesReached); }

    const readings = await db.readingEntries.where('date').equals(date).toArray();
    setTodayReadingMins(readings.reduce((s, r) => s + r.minutes, 0));

    const cleaning = await db.cleaningEntries.where('date').equals(date).toArray();
    setCleaningMins(cleaning.reduce((s, c) => s + c.minutes, 0));

    const fin = await db.financialTasks.where('date').equals(date).toArray();
    setFinancialTasks(fin);
  }

  async function addWater(ml: number) {
    if (ml < 0 && waterMl <= 0) return;
    if (ml < 0) {
      const entries = await db.waterEntries.where('date').equals(date).toArray();
      if (entries.length > 0) {
        const last = entries[entries.length - 1];
        if (last.ml + ml <= 0) await db.waterEntries.delete(last.id);
        else await db.waterEntries.update(last.id, { ml: last.ml + ml });
      }
    } else {
      await db.waterEntries.add({ id: uid(), date, ml });
    }
    loadAll();
  }

  async function addWorkout() {
    const mins = parseInt(workoutMins);
    if (isNaN(mins) || mins <= 0) return;
    await db.workoutEntries.add({ id: uid(), date, minutes: mins, weekStart });
    const newWeekly = weeklyWorkout + mins;
    if (newWeekly >= workoutGoal && weeklyWorkout < workoutGoal) {
      await db.workoutGoal.update('goal', { timesReached: timesReached + 1 });
    }
    setWorkoutMins('');
    setShowWorkoutInput(false);
    loadAll();
  }

  async function increaseGoal() {
    await db.workoutGoal.update('goal', { weeklyMinutes: workoutGoal + 10 });
    loadAll();
  }

  async function logCleaning() {
    await db.cleaningEntries.add({ id: uid(), date, minutes: 20 });
    loadAll();
  }

  async function addFinancial() {
    if (!finInput.trim()) return;
    await db.financialTasks.add({ id: uid(), date, description: finInput.trim(), completed: false });
    setFinInput('');
    setShowFinAdd(false);
    loadAll();
  }

  async function toggleFinancial(id: string, completed: boolean) {
    await db.financialTasks.update(id, { completed });
    loadAll();
  }

  async function deleteFinancial(id: string) {
    await db.financialTasks.delete(id);
    loadAll();
  }

  async function onReadingComplete() {
    await db.readingEntries.add({ id: uid(), date, minutes: 15 });
    setShowReadingTimer(false);
    loadAll();
  }

  const glasses = Math.floor(waterMl / 250);
  const cleaningDone = cleaningMins >= 20;
  const finDone = financialTasks.filter(f => f.completed).length;
  const healthProg = calcHealthProgress(waterMl, weeklyWorkout, workoutGoal, todayReadingMins);
  const envProg = calcEnvironmentProgress(cleaningDone, financialTasks.length, finDone);

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Health & Environment</h2>
      </div>

      {/* Inner Environment */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Sparkles size={18} color="var(--color-primary)" />
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>Inner Environment</span>
        </div>
        <ProgressBar value={healthProg} label="Health Progress" height={8} />
      </div>

      {/* Water */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Droplets size={18} color="#5B9EA0" />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Water Intake</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-muted)' }}>{waterMl} / 2000 ml</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ fontSize: 22, opacity: i < glasses ? 1 : 0.25, cursor: 'pointer' }}
              onClick={() => addWater(250)}>💧</div>
          ))}
        </div>
        <ProgressBar value={Math.min((waterMl / 2000) * 100, 100)} height={6} showPercent={false} color="#5B9EA0" />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {[150, 250, 330, 500].map(ml => (
            <button key={ml} onClick={() => addWater(ml)} className="btn-ghost" style={{ flex: 1, fontSize: 12, padding: '8px 0' }}>
              +{ml}
            </button>
          ))}
        </div>
        <button onClick={() => addWater(-250)} className="btn-ghost"
          style={{ width: '100%', marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
          − Remove one glass (250ml)
        </button>
      </div>

      {/* Workout */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Dumbbell size={18} color="var(--color-primary)" />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Workout</span>
        </div>
        <ProgressBar value={Math.min((weeklyWorkout / workoutGoal) * 100, 100)}
          label={`This week: ${weeklyWorkout} / ${workoutGoal} min`} height={8} />
        {timesReached >= 2 && (
          <button onClick={increaseGoal} className="btn-ghost" style={{ marginTop: 8, fontSize: 12, width: '100%' }}>
            🏆 Increase goal to {workoutGoal + 10} min
          </button>
        )}
        {showWorkoutInput ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input className="input" type="number" placeholder="Minutes" value={workoutMins}
              onChange={e => setWorkoutMins(e.target.value)} style={{ flex: 1 }} />
            <button className="btn-primary" onClick={addWorkout}>Log</button>
            <button className="btn-ghost" onClick={() => setShowWorkoutInput(false)}>✕</button>
          </div>
        ) : (
          <button onClick={() => setShowWorkoutInput(true)} className="btn-primary" style={{ width: '100%', marginTop: 10 }}>
            + Log workout
          </button>
        )}
      </div>

      {/* Reading */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <BookOpen size={18} color="#C8D5A0" />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Reading</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: todayReadingMins >= 15 ? 'green' : 'var(--color-text-muted)' }}>
            {todayReadingMins} / 15 min {todayReadingMins >= 15 ? '✓' : ''}
          </span>
        </div>
        <ProgressBar value={Math.min((todayReadingMins / 15) * 100, 100)} height={6} showPercent={false} color="#C8D5A0" />
        <button onClick={() => setShowReadingTimer(true)} className="btn-primary" style={{ width: '100%', marginTop: 10 }}>
          ⏱ Start 15-min timer
        </button>
      </div>

      {/* Outer Environment */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Sparkles size={18} color="#C8D5A0" />
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>Outer Environment</span>
        </div>
        <ProgressBar value={envProg} label="Environment Progress" height={8} />
      </div>

      {/* Cleaning */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>🧹</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Cleaning</span>
          {cleaningDone && <span style={{ marginLeft: 'auto', color: 'green', fontSize: 13 }}>✓ Done!</span>}
        </div>
        <button
          onClick={logCleaning}
          disabled={cleaningDone}
          className={cleaningDone ? 'btn-ghost' : 'btn-primary'}
          style={{ width: '100%', opacity: cleaningDone ? 0.6 : 1 }}
        >
          {cleaningDone ? '✓ Logged 20 min cleaning' : '✅ Log 20 min of cleaning'}
        </button>
      </div>

      {/* Financial */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>💰</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Financial</span>
          <button onClick={() => setShowFinAdd(true)} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer'
          }}>
            <Plus size={20} color="var(--color-primary)" />
          </button>
        </div>
        {financialTasks.map(ft => (
          <div key={ft.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <button onClick={() => toggleFinancial(ft.id, !ft.completed)} style={{
              width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--color-primary)',
              background: ft.completed ? 'var(--color-primary)' : 'transparent',
              cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {ft.completed && <Check size={12} color="white" strokeWidth={3} />}
            </button>
            <span style={{ flex: 1, fontSize: 14, textDecoration: ft.completed ? 'line-through' : 'none',
              color: ft.completed ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{ft.description}</span>
            <button onClick={() => deleteFinancial(ft.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <Trash2 size={14} color="var(--color-text-muted)" />
            </button>
          </div>
        ))}
        {financialTasks.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>No financial goals today</p>
        )}
        {showFinAdd && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input className="input" placeholder="Financial goal..." value={finInput}
              onChange={e => setFinInput(e.target.value)} style={{ flex: 1 }} />
            <button className="btn-primary" onClick={addFinancial}>Add</button>
            <button className="btn-ghost" onClick={() => setShowFinAdd(false)}>✕</button>
          </div>
        )}
      </div>

      <Modal open={showReadingTimer} onClose={() => setShowReadingTimer(false)} title="Reading Timer">
        <CountdownTimer minutes={15} onComplete={onReadingComplete} label="Read for 15 minutes 📖" />
        <button className="btn-ghost" onClick={onReadingComplete} style={{ width: '100%', marginTop: 12 }}>
          ✓ Mark as done manually
        </button>
      </Modal>
    </div>
  );
}
