import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Heart, BookOpen, Gift, Calendar, BookMarked, Flame, Settings, Sun, Dumbbell, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { db } from '../../db';
import { today, getGreeting, getWeekStart, addDays } from '../../utils/dateUtils';
import { calcTaskProgress, calcHealthProgress, calcMasterProgress, calcWorkoutProgress } from '../../utils/progress';
import ProgressBar from '../ui/ProgressBar';
import RewardPopup from '../ui/RewardPopup';
import type { Screen } from '../../store/appStore';

interface SectionProgress { tasks: number; health: number; workout: number; }

const CARD_NAV: { icon: React.FC<any>; label: string; screen: Screen; color: string }[] = [
  { icon: CheckSquare, label: 'Tasks',    screen: 'tasks',    color: '#E8916A' },
  { icon: Heart,       label: 'Health',   screen: 'health',   color: '#F5A07A' },
  { icon: BookOpen,    label: 'Books',    screen: 'books',    color: '#C8D5A0' },
  { icon: Gift,        label: 'Rewards',  screen: 'rewards',  color: '#F7DC8A' },
  { icon: Calendar,    label: 'Calendar', screen: 'calendar', color: '#E8916A' },
  { icon: BookMarked,  label: 'Diary',    screen: 'diary',    color: '#5B9EA0' },
];

// Pastel colours for sleep zones
const SLEEP_COLORS = {
  red:   { bg: '#FFCECE', needle: '#E07070', text: '#B04040' },
  green: { bg: '#C4ECC4', needle: '#50A850', text: '#2A7A2A' },
  blue:  { bg: '#B8D8FF', needle: '#4888D8', text: '#1850A0' },
};

function getSleepZone(totalMins: number) {
  const h = totalMins / 60;
  if (h < 7)    return 'red';
  if (h <= 9.5) return 'green';
  return 'blue';
}

/** Semi-circular gauge with 3 colour zones and an animated needle */
function SleepGauge({ totalMins }: { totalMins: number }) {
  const zone = getSleepZone(totalMins);
  const col = SLEEP_COLORS[zone];

  // needle rotation: 0° = straight up; -60° = far left; +60° = far right
  const needleRot = zone === 'red' ? -62 : zone === 'green' ? 0 : 62;

  // viewBox 100×60, centre (50,60), outer r=48, inner r=32
  // arc goes from far-left (2,60) through top to far-right (98,60)
  // 3 zones × 60° each, boundary points:
  //   α=60  outer:(26,18.4) inner:(34,32.3)
  //   α=120 outer:(74,18.4) inner:(66,32.3)
  const dim = '#E8E8E8';
  const zones = {
    red:   { outer: 'M 2 60 A 48 48 0 0 1 26 18.4 L 34 32.3 A 32 32 0 0 0 18 60 Z', active: '#FFCECE' },
    green: { outer: 'M 26 18.4 A 48 48 0 0 1 74 18.4 L 66 32.3 A 32 32 0 0 0 34 32.3 Z', active: '#C4ECC4' },
    blue:  { outer: 'M 74 18.4 A 48 48 0 0 1 98 60 L 82 60 A 32 32 0 0 0 66 32.3 Z', active: '#B8D8FF' },
  };

  return (
    <svg viewBox="0 0 100 62" style={{ width: 88, height: 55, flexShrink: 0 }}>
      {(Object.entries(zones) as [keyof typeof zones, typeof zones.red][]).map(([z, { outer, active }]) => (
        <path key={z} d={outer} fill={z === zone ? active : dim} />
      ))}
      {/* zone dividers */}
      <line x1="26" y1="18.4" x2="34" y2="32.3" stroke="white" strokeWidth="1.5" />
      <line x1="74" y1="18.4" x2="66" y2="32.3" stroke="white" strokeWidth="1.5" />
      {/* needle */}
      <g style={{
        transform: `rotate(${needleRot}deg)`,
        transformOrigin: '50px 60px',
        transition: 'transform 0.9s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <line x1="50" y1="60" x2="50" y2="24"
          stroke={col.needle} strokeWidth="3.5" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="60" r="5" fill={col.needle} />
    </svg>
  );
}

export default function DashboardScreen() {
  const { navigate, energyLevel, setViewingDate } = useAppStore();
  const [progress, setProgress] = useState<SectionProgress>({ tasks: 0, health: 0, workout: 0 });
  const [weeklyWorkout, setWeeklyWorkout] = useState(0);
  const [workoutGoal, setWorkoutGoal] = useState(60);
  const [streak, setStreak] = useState(0);
  const [rewardPopup, setRewardPopup] = useState<{ tier: 1|2|3|4 } | null>(null);
  const [sleepSummary, setSleepSummary] = useState<{ totalMins: number; bedtime: string; wakeTime: string } | null>(null);
  const [missingBedtime, setMissingBedtime] = useState(false);

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

    if (bedtime && wakeTime) {
      const [bH, bM] = bedtime.split(':').map(Number);
      const [wH, wM] = wakeTime.split(':').map(Number);
      let totalMins = (wH * 60 + wM) - (bH * 60 + bM);
      if (totalMins < 0) totalMins += 24 * 60;
      setSleepSummary({ totalMins, bedtime, wakeTime });
      setMissingBedtime(false);
    } else if (!bedtime) {
      setSleepSummary(null);
      setMissingBedtime(true);
    } else {
      setSleepSummary(null);
      setMissingBedtime(false);
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

  function jumpToYesterdayHealth() {
    const yesterday = addDays(today(), -1);
    setViewingDate(yesterday);
    navigate('health');
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

        {/* Sleep gauge */}
        {sleepSummary && (() => {
          const zone = getSleepZone(sleepSummary.totalMins);
          const col = SLEEP_COLORS[zone];
          const h = Math.floor(sleepSummary.totalMins / 60);
          const m = sleepSummary.totalMins % 60;
          const label = zone === 'red' ? 'Below optimal' : zone === 'green' ? 'Well rested' : 'Oversleep zone';
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: col.bg + '60', borderRadius: 16, padding: '12px 16px',
              marginBottom: 14, border: `1.5px solid ${col.bg}`,
            }}>
              <SleepGauge totalMins={sleepSummary.totalMins} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 22, color: col.text, lineHeight: 1 }}>
                  {h}h{m > 0 ? ` ${m}m` : ''}
                </div>
                <div style={{ fontSize: 12, color: col.text, fontWeight: 600, marginTop: 2 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  🌙 {sleepSummary.bedtime} · 🌅 {sleepSummary.wakeTime}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Missing bedtime warning */}
        {missingBedtime && !sleepSummary && (
          <button
            onClick={jumpToYesterdayHealth}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              background: '#FFF4D4', border: '1.5px solid #F0C040', borderRadius: 14,
              padding: '11px 14px', cursor: 'pointer', marginBottom: 14, textAlign: 'left',
            }}
          >
            <AlertTriangle size={18} color="#C08000" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#806000' }}>Missing bedtime from yesterday</div>
              <div style={{ fontSize: 11, color: '#A08000', marginTop: 2 }}>Tap to log it in yesterday's Health tab</div>
            </div>
          </button>
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
