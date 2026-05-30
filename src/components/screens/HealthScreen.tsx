import { useState, useEffect } from 'react';
import { Droplets, Dumbbell, BookOpen, Sparkles, Trash2 } from 'lucide-react';
import { db } from '../../db';
import { today, uid, getWeekStart } from '../../utils/dateUtils';
import { calcHealthProgress, calcEnvironmentProgress } from '../../utils/progress';
import ProgressBar from '../ui/ProgressBar';
import CountdownTimer from '../ui/CountdownTimer';
import Modal from '../ui/Modal';
import type { WorkoutEntry, ReadingEntry, CleaningEntry, IncomeEntry } from '../../types';

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
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [showWorkoutInput, setShowWorkoutInput] = useState(false);
  const [workoutMins, setWorkoutMins] = useState('');
  const [showReadingTimer, setShowReadingTimer] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeNote, setIncomeNote] = useState('');
  const [showIncomeAdd, setShowIncomeAdd] = useState(false);

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

    const income = await db.incomeEntries.where('date').equals(date).toArray();
    setIncomeEntries(income);
  }

  async function addWater(ml: number) {
    if (ml > 0) {
      await db.waterEntries.add({ id: uid(), date, ml });
    } else {
      const entries = await db.waterEntries.where('date').equals(date).toArray();
      entries.sort((a, b) => a.id.localeCompare(b.id));
      let toRemove = Math.abs(ml);
      for (let i = entries.length - 1; i >= 0 && toRemove > 0; i--) {
        const e = entries[i];
        if (e.ml <= toRemove) {
          await db.waterEntries.delete(e.id);
          toRemove -= e.ml;
        } else {
          await db.waterEntries.update(e.id, { ml: e.ml - toRemove });
          toRemove = 0;
        }
      }
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

  async function addIncome() {
    const amount = parseFloat(incomeAmount);
    if (isNaN(amount) || amount <= 0) return;
    await db.incomeEntries.add({ id: uid(), date, amount, note: incomeNote.trim() || undefined });
    setIncomeAmount('');
    setIncomeNote('');
    setShowIncomeAdd(false);
    loadAll();
  }

  async function deleteIncome(id: string) {
    await db.incomeEntries.delete(id);
    loadAll();
  }

  async function onReadingComplete() {
    await db.readingEntries.add({ id: uid(), date, minutes: 15 });
    setShowReadingTimer(false);
    loadAll();
  }

  const glasses = Math.floor(waterMl / 250);
  const cleaningDone = cleaningMins >= 20;
  const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
  const healthProg = calcHealthProgress(waterMl, weeklyWorkout, workoutGoal, todayReadingMins);
  const envProg = calcEnvironmentProgress(cleaningDone);

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>

      {/* Inner Environment */}
      <div className="card" style={{ marginTop: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Sparkles size={18} color="var(--color-primary)" />
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>Inner Environment</span>
        </div>
        <ProgressBar value={healthProg} label="Health Progress" height={8} />
      </div>

      {/* Water */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Droplets size={18} color="#5B9EA0" />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Water Intake</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-muted)' }}>{waterMl} / 2000 ml</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 14 }}>
          <button onClick={() => addWater(-250)} disabled={waterMl <= 0} style={{
            width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--color-border)',
            background: 'var(--color-bg)', fontSize: 22, cursor: waterMl > 0 ? 'pointer' : 'default',
            opacity: waterMl > 0 ? 1 : 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>−</button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 40, fontWeight: 800, color: '#5B9EA0', lineHeight: 1 }}>{glasses}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>glasses · {waterMl}ml</p>
          </div>
          <button onClick={() => addWater(250)} style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            background: '#5B9EA0', fontSize: 22, cursor: 'pointer', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>+</button>
        </div>

        <ProgressBar value={Math.min((waterMl / 2000) * 100, 100)} height={8} showPercent={false} color="#5B9EA0" />
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

      {/* Income */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>💰</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Income</span>
          {totalIncome > 0 && (
            <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 15, color: 'var(--color-primary)' }}>
              ${totalIncome.toFixed(2)}
            </span>
          )}
        </div>
        {incomeEntries.map(e => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ flex: 1, fontSize: 14, color: 'var(--color-text)' }}>
              ${e.amount.toFixed(2)}{e.note ? ` · ${e.note}` : ''}
            </span>
            <button onClick={() => deleteIncome(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <Trash2 size={14} color="var(--color-text-muted)" />
            </button>
          </div>
        ))}
        {showIncomeAdd ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="input" type="number" placeholder="Amount ($)" value={incomeAmount}
                onChange={e => setIncomeAmount(e.target.value)} style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="Note (optional)" value={incomeNote}
                onChange={e => setIncomeNote(e.target.value)} style={{ flex: 1 }} />
              <button className="btn-primary" onClick={addIncome}>Add</button>
              <button className="btn-ghost" onClick={() => setShowIncomeAdd(false)}>✕</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowIncomeAdd(true)} className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
            + Log income
          </button>
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
