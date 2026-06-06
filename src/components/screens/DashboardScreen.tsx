import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Heart, BookOpen, Gift, Calendar, BookMarked, Flame, Settings, Sun, Dumbbell, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { db } from '../../db';
import { today, getGreeting, getWeekStart, addDays } from '../../utils/dateUtils';
import { calcTaskProgress, calcHealthProgress, calcMasterProgress, calcWorkoutProgress } from '../../utils/progress';
import ProgressBar from '../ui/ProgressBar';
import RewardPopup from '../ui/RewardPopup';
import { SleepGauge, getSleepZone, SLEEP_COLORS, formatSleepLabel } from '../ui/SleepGauge';
import type { Screen } from '../../store/appStore';

interface SectionProgress { tasks: number; health: number; workout: number; }

const CARD_NAV: { icon: React.FC<any>; label: string; screen: Screen; cssVar: string }[] = [
  { icon: CheckSquare, label: 'Tasks',    screen: 'tasks',    cssVar: '--color-primary' },
  { icon: Heart,       label: 'Health',   screen: 'health',   cssVar: '--color-primary' },
  { icon: BookOpen,    label: 'Books',    screen: 'books',    cssVar: '--color-accent' },
  { icon: Gift,        label: 'Rewards',  screen: 'rewards',  cssVar: '--color-accent' },
  { icon: Calendar,    label: 'Calendar', screen: 'calendar', cssVar: '--color-primary' },
  { icon: BookMarked,  label: 'Diary',    screen: 'diary',    cssVar: '--color-accent' },
];


export default function DashboardScreen() {
  const { navigate, energyLevel, setViewingDate } = useAppStore();
  const [progress, setProgress] = useState<SectionProgress>({ tasks: 0, health: 0, workout: 0 });
  const [weeklyWorkout, setWeeklyWorkout] = useState(0);
  const [workoutGoal, setWorkoutGoal] = useState(60);
  const [streak, setStreak] = useState(0);
  const [rewardPopup, setRewardPopup] = useState<{ tier: 1|2|3|4 } | null>(null);
  const [sleepSummary, setSleepSummary] = useState<{ totalMins: number; bedtime: string; wakeTime: string } | null>(null);
  const [missingBedtime, setMissingBedtime] = useState(false);
  const [weightStats, setWeightStats] = useState<{ first: number; weekStart: number; current: number } | null>(null);
  const [showWeightGraph, setShowWeightGraph] = useState(false);
  const [allWeightEntries, setAllWeightEntries] = useState<{ date: string; kg: number }[]>([]);
  const [weightGraphTab, setWeightGraphTab] = useState<'month' | 'alltime'>('month');

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

    // Weight stats for dashboard widget
    const allWeights = await db.weightEntries.orderBy('date').toArray();
    setAllWeightEntries(allWeights.map(w => ({ date: w.date, kg: w.kg })));
    if (allWeights.length >= 2) {
      const firstKg = allWeights[0].kg;
      const currentKg = allWeights[allWeights.length - 1].kg;
      const monday = getWeekStart(date);
      const weekWeights = allWeights.filter(w => w.date >= monday);
      const weekStartKg = weekWeights.length > 0 ? weekWeights[0].kg : currentKg;
      setWeightStats({ first: firstKg, weekStart: weekStartKg, current: currentKg });
    } else {
      setWeightStats(null);
    }

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
        {CARD_NAV.map(({ icon: Icon, label, screen, cssVar }, i) => (
          <motion.button
            key={screen}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            onClick={() => navigate(screen)}
            style={{
              background: 'var(--color-surface)', border: `1.5px solid var(${cssVar})`,
              borderRadius: 16, padding: '20px 16px', cursor: 'pointer', textAlign: 'left',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 8
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12,
              background: `color-mix(in srgb, var(${cssVar}) 20%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} color={`var(${cssVar})`} />
            </div>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>{label}</span>
          </motion.button>
        ))}
      </div>

      {/* Weight stats */}
      {weightStats && (() => {
        const totalDiff = +(weightStats.current - weightStats.first).toFixed(1);
        const weekDiff = +(weightStats.current - weightStats.weekStart).toFixed(1);
        const totalUp = totalDiff > 0;
        const weekUp = weekDiff > 0;
        const totalColor = totalUp ? '#E05555' : '#3A9E5A';
        const weekColor = weekUp ? '#E05555' : '#3A9E5A';

        function StatTile({ label, diff, up, color }: { label: string; diff: number; up: boolean; color: string }) {
          return (
            <div onClick={() => navigate('health')} style={{
              flex: 1, background: 'var(--color-surface)', borderRadius: 16,
              padding: '14px 16px', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {up
                  ? <TrendingUp size={18} color={color} />
                  : <TrendingDown size={18} color={color} />}
                <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>
                  {diff === 0 ? '—' : `${Math.abs(diff)} kg`}
                </span>
              </div>
              {diff !== 0 && (
                <span style={{ fontSize: 11, color, fontWeight: 600 }}>
                  {up ? '▲ gained' : '▼ lost'}
                </span>
              )}
            </div>
          );
        }

        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ padding: '16px 20px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>
                ⚖️ Weight Stats
              </p>
              <button onClick={() => setShowWeightGraph(true)} style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                color: 'var(--color-text-muted)', fontWeight: 600,
              }}>📊 Graph</button>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <StatTile label="All-time change" diff={totalDiff} up={totalUp} color={totalColor} />
              <StatTile label="This week" diff={weekDiff} up={weekUp} color={weekColor} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '8px 0 0', textAlign: 'center' }}>
              Current: {weightStats.current} kg
            </p>
          </motion.div>
        );
      })()}

      <RewardPopup
        open={!!rewardPopup}
        tier={rewardPopup?.tier ?? 1}
        energyLevel={energyLevel}
        onClose={() => setRewardPopup(null)}
      />
    </div>
  );
}
