import type { Task } from '../types';
import { today } from './dateUtils';

export function calcTaskProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;

  const todayStr = today();
  const scaryTasks = tasks.filter(t => t.scary);

  // Find highest scary dominance (day 1=20%, day2=40%...day5+=100%)
  let scaryDominance = 0;
  for (const st of scaryTasks) {
    const addedDate = st.scaryAddedDate || st.date;
    const [sy, sm, sd] = addedDate.split('-').map(Number);
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const addedMs = new Date(sy, sm - 1, sd).getTime();
    const todayMs = new Date(ty, tm - 1, td).getTime();
    const daysAvoided = Math.max(0, Math.floor((todayMs - addedMs) / 86400000));
    const cap = (daysAvoided + 1) * 20;
    scaryDominance = Math.max(scaryDominance, cap);
  }

  const regularTasks = tasks.filter(t => !t.scary && !t.overload);
  const regularTotal = regularTasks.reduce((s, t) => s + t.difficulty, 0);
  const regularDone = regularTasks.filter(t => t.completed).reduce((s, t) => s + t.difficulty, 0);
  const regularPct = regularTotal === 0 ? (scaryTasks.length > 0 ? 0 : 0) : regularDone / regularTotal;

  if (scaryTasks.length === 0) {
    return regularTotal === 0 ? 0 : Math.round((regularDone / regularTotal) * 100);
  }

  const scaryTotal = scaryTasks.reduce((s, t) => s + t.difficulty, 0);
  const scaryDone = scaryTasks.filter(t => t.completed).reduce((s, t) => s + t.difficulty, 0);
  const scaryPct = scaryTotal === 0 ? 0 : scaryDone / scaryTotal;

  const scarySplit = scaryDominance / 100;
  return Math.max(0, Math.min(100, Math.round((scaryPct * scarySplit + regularPct * (1 - scarySplit)) * 100)));
}

// Health bar = water (1/3) + weight logged (1/3) + cleaning done (1/3)
export function calcHealthProgress(
  waterMl: number,
  weightLogged: boolean,
  cleaningDone: boolean
): number {
  const water = Math.min(waterMl / 2000, 1);
  const weight = weightLogged ? 1 : 0;
  const cleaning = cleaningDone ? 1 : 0;
  return Math.round(((water + weight + cleaning) / 3) * 100);
}

export function calcWorkoutProgress(weeklyMins: number, weeklyGoal: number): number {
  return Math.min(Math.round((weeklyMins / weeklyGoal) * 100), 100);
}

export function calcMasterProgress(taskPct: number, healthPct: number): number {
  return Math.round((taskPct + healthPct) / 2);
}

export function getTier(progress: number): 1 | 2 | 3 | 4 {
  if (progress < 25) return 1;
  if (progress < 50) return 2;
  if (progress < 75) return 3;
  return 4;
}

// Legacy — kept for CalendarScreen compatibility
export function calcEnvironmentProgress(cleaningDone: boolean): number {
  return cleaningDone ? 100 : 0;
}

export function calcLifeProgress(lifeTasksAddedToday: number): number {
  return Math.min(Math.round((lifeTasksAddedToday / 3) * 100), 100);
}
