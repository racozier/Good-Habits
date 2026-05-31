import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Heart, BookOpen, Gift, Calendar, BookMarked, Moon, Flame, Settings, Sun, Dumbbell } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { db } from '../../db';
import { today, getGreeting, getWeekStart, addDays } from '../../utils/dateUtils';
import { calcTaskProgress, calcHealthProgress, calcMasterProgress, calcWorkoutProgress } from '../../utils/progress';
import ProgressBar from '../ui/ProgressBar';
import RewardPopup from '../ui/RewardPopup';
import type { Screen } from '../../store/appStore';

interface SectionProgress { tasks: number; health: number; workout: number; }

const CARD_NAV: { icon: React.FC<any>; label: string; screen: Screen; color: string }[] = [
  { icon: CheckSquare, label: 'Tasks', screen: 'tasks', color: '#E8916A' },
  { icon: Heart, label: 'Health', screen: 'health', color: '#F5A07A' },
  { icon: BookOpen, label: 'Books', screen: 'books', color: '#C8D5A0' },
  { icon: Gift, label: 'Rewards', screen: 'rewards', color: '#F7DC8A' },
  { icon: Calendar, label: 'Calendar', screen: 'calendar', color: '#E8916A' },
  { icon: BookMarked, label: 'Diary', screen: 'diary', color: '#5B9EA0' },
  { icon: Moon, label: 'Sleep', screen: 'sleep', color: '#C8D5A0' },
];

export default function DashboardScreen() {
  const { navigate, energyLevel } = useAppStore();
  const [progress, setProgress] = useState<SectionProgress>({ tasks: 0, health: 0, workout: 0 });
  const [weeklyWorkout, setWeeklyWorkout] = useState(0);
  const [workoutGoal, setWorkoutGoal] = useState(60);
  const [streak, setStreak] = useState(0);
  const [rewardPopup, setRewardPopup] = useState<{ tier: 1|2|3|4 } | null>(null);
  const [sleepSummary, setSleepSummary] = useState<{ hours: number; mins: number; bedtime: string; wakeTime: string } | null>(null);

  useEffect(() => {
    loadProgress();
    const onFocus = () => loadProgress();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function loadProgress() {
    const date = today();
    const weekStart = getWeekStart(date);

    const tasks = await db.tasks.where('date').equals(date).toArray();
    const taskProg = calcTaskProgress(tasks);

    const waterEntries = await db.waterEntries.where('date').equals(date).toArray();
    const totalWater = waterEntries.reduce((s, w) => s + w.ml, 0);

    const weights = await db.weightEntries.where('date').equals(date).toArray();
    const weightLogged = weights.length > 0;

    const cleaning = await db.cleaningEntries.where('date').equals(date).toArray();
    const cleaningDone = cleaning.reduce((s, c) => s + c.minutes, 0) >= 20;

    const healthProg = calcHealthProgress(totalWater, weightLogged, cleaningDone);

    const workouts = await db.workoutEntries.where('weekStart').equals(weekStart).toArray();
    const wkMins = workouts.reduce((s, w) => s + w.minutes, 0);
    const goal = await db.workoutGoal.get('goal');
    const wkGoal = goal?.weeklyMinutes ?? 60;
    setWeeklyWorkout(wkMins);
    setWorkoutGoal(wkGoal);
    const workoutProg = calcWorkoutProgress(wkMins, wkGoal);

    const settings = await db.appSettings.get('settings');
    setStreak(settings?.streak.current ?? 0);

    // Sleep: yesterday's bedtime → today's wake-up time
    const yesterday = addDays(date, -1);
    const [todayDs, yesterdayDs] = await Promise.all([
      db.daySettings.get(date),
      db.daySettings.get(yesterday),
    ]);
    const wakeTime = todayDs?.wakeTime;
    const bedtime = yesterdayDs?.bedtime;
    if (wakeTime && bedtime) {
      const [bH, bM] = bedtime.split(':').map(Number);
      const [wH, wM] = wakeTime.split(':').map(Number);
      let totalMins = (wH * 60 + wM) - (bH * 60 + bM);
      if (totalMins < 0) totalMins += 24 * 60; // crossed midnight
      setSleepSummary({ hours: Math.floor(totalMins / 60), mins: totalMins % 60, bedtime, wakeTime });
    } else {
      setSleepSummary(null);
    }

    const newProgress = { tasks: taskProg, health: healthProg, workout: workoutProg };
    setProgress(newProgress);

    const newMaster = calcMasterProgress(taskProg, healthProg);
    const claimedKey = `reward-claimed-${date}`;
    const claimed: number[] = JSON.parse(localStorage.getItem(claimedKey) || '[]');
    const thresholds: [number, 1|2|3|4][] = [[25,1],[50,2],[75,3],[100,4]];
    for (const [threshold, tier] of thresholds) {
      if (newMaster >= threshold && !claimed.includes(tier)) {
        localStorage.setItem(claimedKey, JSON.stringify([...claimed, tier]));
        setRewardPopup({ tier });
        break;
      }
    }
  }

  const master = calcMasterProgress(progress.tasks, progress.health);

  return (
    <div className="screen" style={{ padding: '0 0 80px' }}>
      <div style={{ padding: '20px 20px 0' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: -0.5 }}>
              Bloomia
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Grow every day
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {streak > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                background: 'var(--color-secondary)', borderRadius: 20, padding: '6px 12px' }}>
                <Flame size={16} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{streak}</span>
              </div>
            )}
            <button onClick={() => navigate('greet')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
              <Sun size={22} color="var(--color-primary)" />
            </button>
            <button onClick={() => navigate('settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
              <Settings size={22} color="var(--color-text-muted)" />
            </button>
          </div>
        </div>

        {/* Greeting */}
        <p style={{ fontSize: 15, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
          {getGreeting()}, Ada! 👋  ·  Energy {energyLevel}/10
        </p>

        {/* Sleep summary */}
        {sleepSummary && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--color-surface)', borderRadius: 14, padding: '10px 14px',
            marginBottom: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          }}>
            <Moon size={16} color="#5B9EA0" />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                {sleepSummary.hours}h {sleepSummary.mins > 0 ? `${sleepSummary.mins}m` : ''} slept
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                {sleepSummary.bedtime} → {sleepSummary.wakeTime}
              </span>
            </div>
            <button onClick={() => navigate('sleep')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, padding: 0,
            }}>Details</button>
          </div>
        )}

        {/* Master progress */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Today's Progress</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)' }}>{master}%</span>
          </div>
          <ProgressBar value={master} showPercent={false} height={14} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
            {[
              { label: '✅ Tasks', value: progress.tasks },
              { label: '💪 Health', value: progress.health },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
                <ProgressBar value={value} height={6} showPercent={true} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Weekly workout widget */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="card" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => navigate('health')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Dumbbell size={16} color="var(--color-primary)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>This week's workout</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-muted)' }}>
              {weeklyWorkout}/{workoutGoal} min
            </span>
          </div>
          <ProgressBar value={progress.workout} height={8} showPercent={false} />
        </motion.div>
      </div>

      {/* Navigation cards */}
      <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {CARD_NAV.map(({ icon: Icon, label, screen, color }, i) => (
          <motion.button
            key={screen}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            onClick={() => navigate(screen)}
            style={{
              background: 'var(--color-surface)', border: 'none', borderRadius: 16,
              padding: '20px 16px', cursor: 'pointer', textAlign: 'left',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 8
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: color + '30',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} color={color} />
            </div>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>{label}</span>
          </motion.button>
        ))}
      </div>

      <RewardPopup
        open={!!rewardPopup}
        tier={rewardPopup?.tier ?? 1}
        energyLevel={energyLevel}
        onClose={() => setRewardPopup(null)}
      />
    </div>
  );
}
