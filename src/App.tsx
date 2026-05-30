import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store/appStore';
import { db, seedDefaultData } from './db';
import { today } from './utils/dateUtils';

import GreetScreen from './components/screens/GreetScreen';
import DashboardScreen from './components/screens/DashboardScreen';
import TasksScreen from './components/screens/TasksScreen';
import HealthScreen from './components/screens/HealthScreen';
import LifeProgressScreen from './components/screens/LifeProgressScreen';
import BooksScreen from './components/screens/BooksScreen';
import RewardsScreen from './components/screens/RewardsScreen';
import CalendarScreen from './components/screens/CalendarScreen';
import DiaryScreen from './components/screens/DiaryScreen';
import SleepScreen from './components/screens/SleepScreen';
import SettingsScreen from './components/screens/SettingsScreen';
import BottomNav from './components/layout/BottomNav';
import Header from './components/layout/Header';

const SCREEN_TITLES: Record<string, string> = {
  greet: '', dashboard: 'Good Habits', tasks: 'Tasks',
  health: 'Health', life: 'Life Goals', books: 'Books',
  rewards: 'Rewards', calendar: 'Calendar', diary: 'Diary',
  sleep: 'Sleep', settings: 'Settings',
};

export default function App() {
  const { screen, theme, navigate } = useAppStore();

  useEffect(() => {
    seedDefaultData();
    checkGreet();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  async function checkGreet() {
    const daySettings = await db.daySettings.get(today());
    if (!daySettings || !daySettings.greetShown) {
      navigate('greet');
    } else {
      navigate('dashboard');
    }
  }

  const showNav = screen !== 'greet';
  const showHeader = screen !== 'greet' && screen !== 'settings';

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>
      {showHeader && (
        <Header
          title={SCREEN_TITLES[screen] || ''}
          showSettings={true}
          showGreet={screen === 'dashboard'}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {screen === 'greet' && <GreetScreen />}
          {screen === 'dashboard' && <DashboardScreen />}
          {screen === 'tasks' && <TasksScreen />}
          {screen === 'health' && <HealthScreen />}
          {screen === 'life' && <LifeProgressScreen />}
          {screen === 'books' && <BooksScreen />}
          {screen === 'rewards' && <RewardsScreen />}
          {screen === 'calendar' && <CalendarScreen />}
          {screen === 'diary' && <DiaryScreen />}
          {screen === 'sleep' && <SleepScreen />}
          {screen === 'settings' && <SettingsScreen />}
        </motion.div>
      </AnimatePresence>

      {showNav && <BottomNav />}
    </div>
  );
}
