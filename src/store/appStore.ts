import { create } from 'zustand';
import type { Theme } from '../types';
import { today } from '../utils/dateUtils';

export type Screen =
  | 'greet' | 'dashboard' | 'tasks' | 'health'
  | 'life' | 'books' | 'rewards' | 'calendar'
  | 'diary' | 'sleep' | 'settings' | 'reader';

export interface EpubReaderState { data: string; title: string; bookId?: string; startChapter?: number; returnScreen: Screen; }

interface AppState {
  screen: Screen;
  theme: Theme;
  todayDate: string;
  energyLevel: number;
  userName: string;
  viewingDate: string;
  epubReader: EpubReaderState | null;
  navigate: (s: Screen) => void;
  setTheme: (t: Theme) => void;
  setEnergyLevel: (n: number) => void;
  setUserName: (n: string) => void;
  setViewingDate: (d: string) => void;
  openEpub: (state: EpubReaderState) => void;
  closeEpub: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'greet',
  theme: 'warm',
  todayDate: today(),
  energyLevel: 5,
  userName: 'Ada',
  viewingDate: today(),
  epubReader: null,
  navigate: (screen) => set({ screen, ...(screen === 'dashboard' ? { viewingDate: today() } : {}) }),
  setTheme: (theme) => set({ theme }),
  setEnergyLevel: (energyLevel) => set({ energyLevel }),
  setUserName: (userName) => set({ userName }),
  setViewingDate: (viewingDate) => set({ viewingDate }),
  openEpub: (epubReader) => set({ epubReader, screen: 'reader' }),
  closeEpub: () => {
    const returnScreen = get().epubReader?.returnScreen ?? 'rewards';
    set({ epubReader: null, screen: returnScreen });
  },
}));
