import Dexie, { type Table } from 'dexie';
import type {
  Task, RecurringTask, WaterEntry, WorkoutEntry, WorkoutGoal,
  ReadingEntry, CleaningEntry, FinancialTask, Book, BookNote, Reward,
  FavoriteBook, LifeGoal, DiaryEntry, SleepEntry, DaySettings, AppSettings
} from '../types';

export class GoodHabitsDB extends Dexie {
  tasks!: Table<Task>;
  recurringTasks!: Table<RecurringTask>;
  waterEntries!: Table<WaterEntry>;
  workoutEntries!: Table<WorkoutEntry>;
  workoutGoal!: Table<WorkoutGoal>;
  readingEntries!: Table<ReadingEntry>;
  cleaningEntries!: Table<CleaningEntry>;
  financialTasks!: Table<FinancialTask>;
  books!: Table<Book>;
  bookNotes!: Table<BookNote>;
  rewards!: Table<Reward>;
  favoriteBook!: Table<FavoriteBook>;
  lifeGoals!: Table<LifeGoal>;
  diaryEntries!: Table<DiaryEntry>;
  sleepEntries!: Table<SleepEntry>;
  daySettings!: Table<DaySettings>;
  appSettings!: Table<AppSettings>;

  constructor() {
    super('GoodHabitsDB');
    this.version(1).stores({
      tasks: 'id, date, completed, isRecurring',
      recurringTasks: 'id',
      waterEntries: 'id, date',
      workoutEntries: 'id, date, weekStart',
      workoutGoal: 'id',
      readingEntries: 'id, date',
      cleaningEntries: 'id, date',
      financialTasks: 'id, date',
      books: 'id',
      bookNotes: 'id, bookId',
      rewards: 'id, tier',
      favoriteBook: 'id',
      lifeGoals: 'id, category',
      diaryEntries: 'id, date',
      sleepEntries: 'id, date',
      daySettings: 'date',
      appSettings: 'id',
    });
  }
}

export const db = new GoodHabitsDB();

// Seed default data on first run
export async function seedDefaultData() {
  const settings = await db.appSettings.get('settings');
  if (settings) return;

  await db.appSettings.put({
    id: 'settings',
    userName: 'Friend',
    theme: 'warm',
    streak: { current: 0, longest: 0, lastCompletedDate: '' },
  });

  await db.workoutGoal.put({ id: 'goal', weeklyMinutes: 60, timesReached: 0 });

  const defaultRewards: Reward[] = [
    { id: 'r1', text: 'Be lazy for 30 mins! 🛋️', durationMinutes: 30, tier: 1 },
    { id: 'r2', text: 'Get a snack and chill! 🍫', durationMinutes: 20, tier: 1 },
    { id: 'r3', text: 'Watch a fun video 📱', durationMinutes: 25, tier: 2 },
    { id: 'r4', text: 'Take a walk outside 🌿', durationMinutes: 30, tier: 2 },
    { id: 'r5', text: 'Long relaxing break 🧘', durationMinutes: 45, tier: 3 },
    { id: 'r6', text: 'Delicious treat + cozy time ☕', durationMinutes: 40, tier: 3 },
    { id: 'r7', text: 'Full recharge — do whatever you love! 🎉', durationMinutes: 60, tier: 4 },
    { id: 'r8', text: 'Read your favorite book — 3 chapters unlocked! 📚', durationMinutes: 60, tier: 4 },
  ];
  await db.rewards.bulkPut(defaultRewards);

  const defaultLifeGoals: LifeGoal[] = [
    { id: 'lg1', text: 'Learn a new language for 30 minutes', category: 'growth', difficulty: 1 },
    { id: 'lg2', text: 'Practice meditation or mindfulness', category: 'physical', difficulty: 1 },
    { id: 'lg3', text: 'Do a workout or yoga session', category: 'physical', difficulty: 2 },
    { id: 'lg4', text: 'Read 20 pages of a non-fiction book', category: 'growth', difficulty: 1 },
    { id: 'lg5', text: 'Write in your journal', category: 'growth', difficulty: 1 },
    { id: 'lg6', text: 'Reach out to someone you care about', category: 'general', difficulty: 1 },
    { id: 'lg7', text: 'Work on a creative project for 1 hour', category: 'growth', difficulty: 2 },
    { id: 'lg8', text: 'Review and update your budget', category: 'stress', difficulty: 2 },
    { id: 'lg9', text: 'Deep clean one area of your home', category: 'environment', difficulty: 2 },
    { id: 'lg10', text: 'Plan your week ahead', category: 'growth', difficulty: 1 },
    { id: 'lg11', text: 'Cook a healthy meal from scratch', category: 'physical', difficulty: 2 },
    { id: 'lg12', text: 'Learn a new skill online for 1 hour', category: 'growth', difficulty: 2 },
    { id: 'lg13', text: 'Sort and organize paperwork', category: 'stress', difficulty: 2 },
    { id: 'lg14', text: 'Research an investment or financial opportunity', category: 'stress', difficulty: 3 },
    { id: 'lg15', text: 'Apply for a job or opportunity', category: 'stress', difficulty: 3 },
    { id: 'lg16', text: 'Schedule and attend an appointment', category: 'stress', difficulty: 3 },
    { id: 'lg17', text: 'Declutter and donate unused items', category: 'environment', difficulty: 2 },
    { id: 'lg18', text: 'Do 30 minutes of cardio', category: 'physical', difficulty: 1 },
    { id: 'lg19', text: 'Practice a musical instrument', category: 'growth', difficulty: 1 },
    { id: 'lg20', text: 'Spend quality time with family', category: 'general', difficulty: 1 },
  ];
  await db.lifeGoals.bulkPut(defaultLifeGoals);
}
