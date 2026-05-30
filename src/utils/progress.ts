import type { Task } from '../types';

export function taskPoints(difficulty: 1 | 2 | 3): number {
  return difficulty;
}

export function calcTaskProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((s, t) => s + taskPoints(t.difficulty), 0);
  const done = tasks.filter(t => t.completed).reduce((s, t) => s + taskPoints(t.difficulty), 0);
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function calcHealthProgress(
  waterMl: number,
  weeklyWorkoutMins: number,
  weeklyGoal: number,
  todayReadingMins: number
): number {
  const water = Math.min(waterMl / 2000, 1);
  const workout = Math.min(weeklyWorkoutMins / weeklyGoal, 1);
  const reading = Math.min(todayReadingMins / 15, 1);
  return Math.round(((water + workout + reading) / 3) * 100);
}

export function calcEnvironmentProgress(
  cleaningDone: boolean,
  financialTotal: number,
  financialDone: number
): number {
  const cleaning = cleaningDone ? 1 : 0;
  const financial = financialTotal === 0 ? 0 : financialDone / financialTotal;
  return Math.round(((cleaning + financial) / 2) * 100);
}

export function calcLifeProgress(lifeTasksAddedToday: number): number {
  return Math.min(Math.round((lifeTasksAddedToday / 3) * 100), 100);
}

export function calcMasterProgress(task: number, health: number, env: number, life: number): number {
  return Math.round((task + health + env + life) / 4);
}

export function getTier(progress: number): 1 | 2 | 3 | 4 {
  if (progress < 25) return 1;
  if (progress < 50) return 2;
  if (progress < 75) return 3;
  return 4;
}
