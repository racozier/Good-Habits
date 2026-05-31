import { create } from 'zustand';
import type { Theme } from '../types';
import { today } from '../utils/dateUtils';

export type Screen =
  | 'greet' | 'dashboard' | 'tasks' | 'health'
  | 'life' | 'books' | 'rewards' | 'calendar'
  | 'diary' | 'sleep' | 'settings';

interface AppState {
  screen: Screen;
  theme: Theme;
  todayDate: string;
  energyLevel: number;
  userName: string;
  viewingDate: string;
  navigate: (s: Screen) => void;
  setTheme: (t: Theme) => void;
  setEnergyLevel: (n: number) => void;
  setUserName: (n: string) => void;
  setViewingDate: (d: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: 'greet',
  theme: 'warm',
  todayDate: today(),
  energyLevel: 5,
  userName: 'Ada',
  viewingDate: today(),
  navigate: (screen) => set({ screen }),
  setTheme: (theme) => set({ theme }),
  setEnergyLevel: (energyLevel) => set({ energyLevel }),
  setUserName: (userName) => set({ userName }),
  setViewingDate: (viewingDate) => set({ viewingDate }),
}));
