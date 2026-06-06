export type Theme = 'warm' | 'cool' | 'terracotta' | 'forest' | 'navycoral' | 'darkmoss' | 'winegold' | 'linensteel' | 'teal' | 'oceanfire' | 'amber' | 'seafoam';
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
  scary?: boolean;
  scaryAddedDate?: string;
  missed?: boolean;
  missedFromDate?: string;
}

export interface RecurringTask {
  id: string;
  text: string;
  difficulty: Difficulty;
  color: TaskColor;
  days: number[];
}

export interface BookNote {
  id: string;
  bookId: string;
  content: string;
  createdAt: number;
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

export interface IncomeEntry {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface WalkEntry {
  id: string;
  date: string;
  minutes: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  coverColor: string;
  coverImage?: string;
  epubData?: string;
  completed: boolean;
  addedAt: number;
  lastOpenedAt?: number;
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
  isCustom?: boolean;
}

export interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  s1?: string;
  s2?: string;
  s3?: string;
  s4?: string;
  s5?: string;
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
  bedtime?: string;
  wakeTime?: string;
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

export interface FastingEntry {
  id: string;
  date: string;
  firstMeal?: string;  // HH:MM time
  lastMeal?: string;   // HH:MM time
}
