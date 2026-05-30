import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Heart, BookOpen, Gift, Calendar, BookMarked, Moon, Flame } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { db } from '../../db';
import { today, getGreeting, getWeekStart } from '../../utils/dateUtils';
import {
  calcTaskProgress, calcHealthProgress, calcEnvironmentProgress,
  calcMasterProgress,
} from '../../utils/progress';
import ProgressBar from '../ui/ProgressBar';
import RewardPopup from '../ui/RewardPopup';
import type { Screen } from '../../store/appStore';

interface SectionProgress { tasks: number; health: number; env: number; }

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
  const { navigate, energyLevel, setEnergyLevel } = useAppStore();
  const [progress, setProgress] = useState<SectionProgress>({ tasks: 0, health: 0, env: 0 });
  const [streak, setStreak] = useState(0);
  const [showEnergySet, setShowEnergySet] = useState(false);
  const [rewardPopup, setRewardPopup] = useState<{ tier: 1|2|3|4 } | null>(null);

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

    const workouts = await db.workoutEntries.where('weekStart').equals(weekStart).toArray();
    const weeklyWorkout = workouts.reduce((s, w) => s + w.minutes, 0);
    const goal = await db.workoutGoal.get('goal');
    const weeklyGoal = goal?.weeklyMinutes ?? 60;

    const readings = await db.readingEntries.where('date').equals(date).toArray();
    const todayReading = readings.reduce((s, r) => s + r.minutes, 0);

    const healthProg = calcHealthProgress(totalWater, weeklyWorkout, weeklyGoal, todayReading);

    const cleaning = await db.cleaningEntries.where('date').equals(date).toArray();
    const cleaningDone = cleaning.reduce((s, c) => s + c.minutes, 0) >= 20;
    const envProg = calcEnvironmentProgress(cleaningDone);

    const settings = await db.appSettings.get('settings');
    setStreak(settings?.streak.current ?? 0);

    const newProgress = { tasks: taskProg, health: healthProg, env: envProg };
    setProgress(newProgress);

    const newMaster = calcMasterProgress(taskProg, healthProg, envProg, 0);
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

  const master = calcMasterProgress(progress.tasks, progress.health, progress.env, 0);

  return (
    <div className="screen" style={{ padding: '0 0 80px' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>{getGreeting()},</p>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text)', margin: '2px 0 0' }}>Ada 👋</h1>
          </div>
          {streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--color-secondary)', borderRadius: 20, padding: '6px 12px' }}>
              <Flame size={16} color="var(--color-primary)" />
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{streak}</span>
            </div>
          )}
        </div>

        {/* Energy level */}
        <div style={{ marginTop: 16 }}>
          {showEnergySet ? (
            <div className="card" style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
                How's your energy today?
              </p>
              <input type="range" min={1} max={10} value={energyLevel}
                onChange={e => setEnergyLevel(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                <span>😴 Low</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 16 }}>{energyLevel}/10</span>
                <span>⚡ High</span>
              </div>
              <button className="btn-primary" onClick={() => setShowEnergySet(false)} style={{ width: '100%', marginTop: 12 }}>
                Set energy
              </button>
            </div>
          ) : (
            <button onClick={() => setShowEnergySet(true)} style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)', borderRadius: 12, padding: '8px 14px',
              cursor: 'pointer', marginBottom: 12, fontSize: 14, color: 'var(--color-text)'
            }}>
              <span>⚡</span>
              <span>Energy: <strong>{energyLevel}/10</strong></span>
              <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: 12 }}>tap to change</span>
            </button>
          )}
        </div>

        {/* Master progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ marginBottom: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Today's Progress</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)' }}>{master}%</span>
          </div>
          <ProgressBar value={master} showPercent={false} height={14} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
            {[
              { label: '✅ Tasks', value: progress.tasks },
              { label: '💪 Health', value: progress.health },
              { label: '🌿 Environment', value: progress.env },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
                <ProgressBar value={value} height={6} showPercent={true} />
              </div>
            ))}
          </div>
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
