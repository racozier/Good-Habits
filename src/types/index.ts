export type Theme = 'warm' | 'cool';
export type Difficulty = 1 | 2 | 3;
export type TaskColor = 'physical' | 'stress' | 'growth' | 'environment' | 'general';
export type Mood = 'great' | 'okay' | 'bad';

export interface Task {
  id: string;
  text: string;
  difficulty: Difficulty;
  color: TaskColor;
  completed: boolean;
  isRecurring: boolean;
  date: string;
  createdAt: number;
}

export interface RecurringTask {
  id: string;
  text: string;
  difficulty: Difficulty;
  color: TaskColor;
}

export interface WaterEntry {
  id: string;
  date: string;
  ml: number;
}

export interface WorkoutEntry {
  id: string;
  date: string;
  minutes: number;
  weekStart: string;
}

export interface WorkoutGoal {
  id: string;
  weeklyMinutes: number;
  timesReached: number;
}

export interface ReadingEntry {
  id: string;
  date: string;
  minutes: number;
  bookId?: string;
}

export interface CleaningEntry {
  id: string;
  date: string;
  minutes: number;
}

export interface FinancialTask {
  id: string;
  date: string;
  description: string;
  completed: boolean;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  coverEmoji: string;
  epubData?: string;
  completed: boolean;
  addedAt: number;
}

export interface Reward {
  id: string;
  text: string;
  durationMinutes: number;
  tier: 1 | 2 | 3 | 4;
}

export interface FavoriteBook {
  id: 'favorite';
  title: string;
  epubData: string;
  totalChapters: number;
  unlockedChapters: number;
}

export interface LifeGoal {
  id: string;
  text: string;
  category: TaskColor;
  difficulty: Difficulty;
}

export interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  mood?: Mood;
}

export interface SleepEntry {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  quality: Mood;
  durationMinutes: number;
}

export interface DaySettings {
  date: string;
  energyLevel: number;
  greetShown: boolean;
}

export interface Streak {
  current: number;
  longest: number;
  lastCompletedDate: string;
}

export interface AppSettings {
  id: 'settings';
  userName: string;
  theme: Theme;
  streak: Streak;
}
