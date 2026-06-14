import { useState, useEffect, useRef } from 'react';
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

function WeightChart({ data, isMonth, daysInMonth }: {
  data: { date: string; kg: number }[];
  isMonth: boolean;
  daysInMonth: number;
}) {
  const [scrub, setScrub] = useState<{ x: number; entry: { date: string; kg: number } } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (data.length === 0) return (
    <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 40, fontSize: 14 }}>No data yet this month</p>
  );

  const W = 320, H = 210, padL = 40, padR = 16, padT = 24, padB = 30;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const kgs = data.map(d => d.kg);
  const minKg = Math.min(...kgs) - 0.3;
  const maxKg = Math.max(...kgs) + 0.3;
  const rangeKg = maxKg - minKg || 1;

  function xForDate(date: string) {
    if (isMonth) {
      const day = parseInt(date.split('-')[2]);
      return padL + ((day - 1) / (daysInMonth - 1)) * cW;
    }
    const n = data.length;
    const i = data.findIndex(d => d.date === date);
    return padL + (n === 1 ? cW / 2 : (i / (n - 1)) * cW);
  }
  function yPos(kg: number) { return padT + cH - ((kg - minKg) / rangeKg) * cH; }

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xForDate(d.date)},${yPos(d.kg)}`).join(' ');
  const latest = data[data.length - 1];
  const lx = xForDate(latest.date);
  const ly = yPos(latest.kg);
  const areaD = data.length > 1
    ? pathD + ` L${xForDate(latest.date)},${padT + cH} L${xForDate(data[0].date)},${padT + cH} Z`
    : '';
  const yGridVals = [Math.min(...kgs), (Math.min(...kgs) + Math.max(...kgs)) / 2, Math.max(...kgs)];
  const xTicks: { label: string; x: number }[] = [];
  if (isMonth) {
    [1, 8, 15, 22, daysInMonth].forEach(d => {
      if (d <= daysInMonth) xTicks.push({ label: String(d), x: padL + ((d - 1) / (daysInMonth - 1)) * cW });
    });
  } else {
    const n = data.length;
    data.forEach((d, i) => {
      if (i === 0 || i === n - 1 || i % Math.max(1, Math.floor(n / 5)) === 0)
        xTicks.push({ label: d.date.slice(5).replace('-', '/'), x: xForDate(d.date) });
    });
  }

  function handlePointer(clientX: number) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const svgX = ratio * W;
    // Find nearest data point by x
    let nearest = data[0];
    let minDist = Infinity;
    data.forEach(d => {
      const dx = Math.abs(xForDate(d.date) - svgX);
      if (dx < minDist) { minDist = dx; nearest = d; }
    });
    if (minDist < cW * 0.15) setScrub({ x: xForDate(nearest.date), entry: nearest });
    else setScrub(null);
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', touchAction: 'none' }}
      onPointerMove={e => handlePointer(e.clientX)}
      onPointerLeave={() => setScrub(null)}
    >
      <defs>
        <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.01" />
        </linearGradient>
        <filter id="wGlow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {yGridVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={yPos(v)} y2={yPos(v)} stroke="var(--color-border)" strokeWidth={0.7} strokeDasharray="5,4" />
          <text x={padL - 5} y={yPos(v) + 4} textAnchor="end" fontSize={9} fill="var(--color-text-muted)">{v.toFixed(1)}</text>
        </g>
      ))}
      {areaD && <path d={areaD} fill="url(#wGrad)" />}
      <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.35} filter="url(#wGlow)" />
      <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => {
        const isLatest = i === data.length - 1;
        return (
          <circle key={d.date} cx={xForDate(d.date)} cy={yPos(d.kg)}
            r={isLatest ? 5 : 3.5}
            fill={isLatest ? 'var(--color-primary)' : 'var(--color-bg)'}
            stroke="var(--color-primary)" strokeWidth={isLatest ? 0 : 2} />
        );
      })}
      <circle cx={lx} cy={ly} r={5} fill="var(--color-primary)" opacity={0}>
        <animate attributeName="r" values="5;14;5" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.55;0;0.55" dur="3s" repeatCount="indefinite" />
      </circle>
      <text x={lx} y={ly - 10} textAnchor="middle" fontSize={10} fontWeight="700" fill="var(--color-primary)">{latest.kg}</text>
      {xTicks.map((t, i) => (
        <text key={i} x={t.x} y={H - 6} textAnchor="middle" fontSize={8} fill="var(--color-text-muted)">{t.label}</text>
      ))}
      {/* Scrub line + tooltip */}
      {scrub && (
        <g>
          <line x1={scrub.x} x2={scrub.x} y1={padT} y2={padT + cH} stroke="var(--color-text)" strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
          <circle cx={scrub.x} cy={yPos(scrub.entry.kg)} r={5} fill="var(--color-text)" />
          <rect
            x={Math.min(scrub.x + 6, W - 78)}
            y={yPos(scrub.entry.kg) - 22}
            width={72} height={20} rx={6}
            fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={1}
          />
          <text
            x={Math.min(scrub.x + 42, W - 42)}
            y={yPos(scrub.entry.kg) - 8}
            textAnchor="middle" fontSize={9} fontWeight="700" fill="var(--color-text)"
          >
            {scrub.entry.kg} kg · {scrub.entry.date.slice(5).replace('-', '/')}
          </text>
        </g>
      )}
    </svg>
  );
}

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
  const [workoutStreak, setWorkoutStreak] = useState(0);
  const [completedWorkoutWeeks, setCompletedWorkoutWeeks] = useState<string[]>([]);
  const [showWorkoutStreak, setShowWorkoutStreak] = useState(false);

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

    // Workout streak calculation
    const allWorkoutsForStreak = await db.workoutEntries.toArray();
    const weekTotals: Record<string, number> = {};
    allWorkoutsForStreak.forEach(w => { weekTotals[w.weekStart] = (weekTotals[w.weekStart] || 0) + w.minutes; });
    const completedWks = Object.entries(weekTotals)
      .filter(([, mins]) => mins >= wkGoal)
      .map(([ws]) => ws)
      .sort();
    setCompletedWorkoutWeeks(completedWks);
    let wkStreak = 0;
    for (let i = completedWks.length - 1; i >= 0; i--) {
      if (i === completedWks.length - 1) { wkStreak = 1; continue; }
      const expected = new Date(completedWks[i + 1] + 'T12:00:00');
      expected.setDate(expected.getDate() - 7);
      const exp = expected.toISOString().split('T')[0];
      if (completedWks[i] === exp) wkStreak++; else break;
    }
    setWorkoutStreak(wkStreak);

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
            {/* Workout streak fire — always visible */}
            <button onClick={() => setShowWorkoutStreak(true)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: workoutStreak > 0 ? 'rgba(255,100,0,0.12)' : 'var(--color-secondary)',
              borderRadius: 20, padding: '6px 12px', border: 'none', cursor: 'pointer',
            }}>
              <span style={{ fontSize: 18, filter: workoutStreak === 0 ? 'grayscale(1) opacity(0.45)' : 'none' }}>🔥</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: workoutStreak > 0 ? '#FF6400' : 'var(--color-text-muted)' }}>
                {workoutStreak}
              </span>
            </button>
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

      {/* Workout streak overlay */}
      {showWorkoutStreak && (() => {
        // Build week history: all weeks from first completed week to now
        const todayStr = today();
        const currentWeekStart = getWeekStart(todayStr);

        // Get earliest week we have any workout data
        const firstWeek = completedWorkoutWeeks.length > 0 ? completedWorkoutWeeks[0] : currentWeekStart;

        // Build all weeks from firstWeek to currentWeekStart
        const allWeeks: string[] = [];
        let w = firstWeek;
        while (w <= currentWeekStart) {
          allWeeks.push(w);
          const next = new Date(w + 'T12:00:00');
          next.setDate(next.getDate() + 7);
          w = next.toISOString().split('T')[0];
        }

        const completedSet = new Set(completedWorkoutWeeks);

        // Group weeks by month label
        const monthGroups: { label: string; weeks: string[] }[] = [];
        allWeeks.forEach(ws => {
          const d = new Date(ws + 'T12:00:00');
          const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
          const last = monthGroups[monthGroups.length - 1];
          if (!last || last.label !== label) monthGroups.push({ label, weeks: [ws] });
          else last.weeks.push(ws);
        });

        function fmtWeekRange(ws: string) {
          const mon = new Date(ws + 'T12:00:00');
          const sun = new Date(ws + 'T12:00:00');
          sun.setDate(sun.getDate() + 6);
          const fmt = (d: Date) => `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
          return `${fmt(mon)} – ${fmt(sun)}`;
        }

        return (
          <>
            <style>{`
              @keyframes firePulse {
                0%, 100% { transform: scale(1); filter: drop-shadow(0 0 3px #FF6400); }
                50% { transform: scale(1.25); filter: drop-shadow(0 0 8px #FF8C00); }
              }
              @keyframes fireBorder {
                0%, 100% { box-shadow: 0 0 6px 1px rgba(255,100,0,0.5), inset 0 0 3px rgba(255,150,0,0.15); border-color: #FF6400; }
                50% { box-shadow: 0 0 12px 3px rgba(255,140,0,0.7), inset 0 0 6px rgba(255,180,0,0.2); border-color: #FF8C00; }
              }
              .fire-badge { animation: firePulse 1.8s ease-in-out infinite; display: inline-block; }
              .fire-week { animation: fireBorder 1.8s ease-in-out infinite; }
            `}</style>
            {/* Backdrop */}
            <div onClick={() => setShowWorkoutStreak(false)} style={{
              position: 'fixed', inset: 0, zIndex: 300,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
            }} />
            {/* Card */}
            <div style={{
              position: 'fixed', bottom: 90, left: 16, right: 16, zIndex: 301,
              background: 'var(--color-surface)', borderRadius: 24,
              boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
              maxHeight: '65vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px 10px', flexShrink: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 17, flex: 1 }}>
                  🔥 Workout Streak
                </span>
                <div style={{
                  background: workoutStreak > 0 ? 'rgba(255,100,0,0.12)' : 'var(--color-bg)',
                  borderRadius: 20, padding: '4px 12px', marginRight: 10,
                }}>
                  <span style={{ fontWeight: 800, fontSize: 20, color: workoutStreak > 0 ? '#FF6400' : 'var(--color-text-muted)' }}>
                    {workoutStreak}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 4 }}>
                    {workoutStreak === 1 ? 'week' : 'weeks'}
                  </span>
                </div>
                <button onClick={() => setShowWorkoutStreak(false)} style={{
                  background: 'var(--color-bg)', border: 'none', borderRadius: 20,
                  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16,
                }}>✕</button>
              </div>
              <p style={{ margin: '0 20px 10px', fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                Goal: {workoutGoal} min/week · {completedWorkoutWeeks.length} week{completedWorkoutWeeks.length !== 1 ? 's' : ''} completed all-time
              </p>
              {/* Scrollable week list */}
              <div style={{ overflowY: 'auto', padding: '0 16px 16px' }}>
                {allWeeks.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 20, fontSize: 14 }}>
                    No workout data yet. Start logging workouts to build your streak!
                  </p>
                ) : (
                  monthGroups.map(group => (
                    <div key={group.label} style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {group.label}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {group.weeks.map(ws => {
                          const done = completedSet.has(ws);
                          const isCurrent = ws === currentWeekStart;
                          return (
                            <div key={ws} className={done ? 'fire-week' : undefined} style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              background: done ? 'rgba(255,100,0,0.07)' : 'var(--color-bg)',
                              borderRadius: 12, padding: '9px 14px',
                              border: done ? '1.5px solid #FF6400' : '1.5px solid var(--color-border)',
                            }}>
                              <span style={{ fontSize: 20 }} className={done ? 'fire-badge' : undefined}>
                                {done ? '🔥' : '○'}
                              </span>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: 13, fontWeight: done ? 600 : 400, color: done ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                  {fmtWeekRange(ws)}
                                </span>
                                {isCurrent && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>this week</span>}
                              </div>
                              {done && <span style={{ fontSize: 11, color: '#FF6400', fontWeight: 700 }}>✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* Weight graph overlay */}
      {showWeightGraph && (() => {
        const now = new Date();
        const yr = now.getFullYear();
        const mo = now.getMonth();
        const monthStr = `${yr}-${String(mo + 1).padStart(2, '0')}`;
        const daysInMonth = new Date(yr, mo + 1, 0).getDate();
        const monthStart = `${monthStr}-01`;
        const monthEntries = allWeightEntries.filter(e => e.date.startsWith(monthStr));
        const entries = weightGraphTab === 'month' ? monthEntries : allWeightEntries;
        const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

        let touchStartX = 0;
        const tabs = ['month', 'alltime'] as const;

        return (
          <>
            {/* Backdrop */}
            <div onClick={() => setShowWeightGraph(false)} style={{
              position: 'fixed', inset: 0, zIndex: 300,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
            }} />
            {/* Floating card */}
            <div style={{
              position: 'fixed', bottom: 90, left: 16, right: 16, zIndex: 301,
              background: 'var(--color-surface)', borderRadius: 24,
              boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px 10px' }}>
                <span style={{ fontWeight: 700, fontSize: 17, flex: 1 }}>⚖️ Weight</span>
                <button onClick={() => setShowWeightGraph(false)} style={{
                  background: 'var(--color-bg)', border: 'none', borderRadius: 20,
                  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16,
                }}>✕</button>
              </div>
              {/* Tab pills */}
              <div style={{ display: 'flex', gap: 8, padding: '0 20px 12px' }}>
                {tabs.map(tab => (
                  <button key={tab} onClick={() => setWeightGraphTab(tab)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 13,
                    background: weightGraphTab === tab ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: weightGraphTab === tab ? 'white' : 'var(--color-text-muted)',
                    transition: 'all 0.2s',
                  }}>
                    {tab === 'month' ? 'This Month' : 'All Time'}
                  </button>
                ))}
              </div>
              {/* Swipe-able chart area */}
              <div style={{ padding: '0 12px 20px', touchAction: 'pan-y' }}
                onTouchStart={e => { touchStartX = e.touches[0].clientX; }}
                onTouchEnd={e => {
                  const dx = e.changedTouches[0].clientX - touchStartX;
                  if (Math.abs(dx) > 50) setWeightGraphTab(dx < 0 ? 'alltime' : 'month');
                }}
              >
                <WeightChart data={sorted} isMonth={weightGraphTab === 'month'} daysInMonth={daysInMonth} />
                <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', margin: '4px 0 0', opacity: 0.6 }}>
                  ← swipe to switch →
                </p>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
