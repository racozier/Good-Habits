import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store/appStore';
import { db, seedDefaultData } from './db';
import { today, uid, addDays } from './utils/dateUtils';

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

export default function App() {
  const { screen, theme, navigate, viewingDate, setViewingDate } = useAppStore();
  const todayStr = today();
  const isViewingPast = viewingDate !== todayStr;

  useEffect(() => {
    seedDefaultData();
    checkGreet();
    doMidnightCarryover();
    // Reset viewingDate to today on fresh load
    setViewingDate(todayStr);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  async function checkGreet() {
    const daySettings = await db.daySettings.get(todayStr);
    if (!daySettings || !daySettings.greetShown) {
      navigate('greet');
    } else {
      navigate('dashboard');
    }
  }

  async function doMidnightCarryover() {
    const key = `carryover-${todayStr}`;
    if (localStorage.getItem(key)) return;

    const yesterday = addDays(todayStr, -1);
    const yesterdayTasks = await db.tasks.where('date').equals(yesterday).toArray();
    const incomplete = yesterdayTasks.filter(t => !t.completed);

    if (incomplete.length > 0) {
      const todayTasks = await db.tasks.where('date').equals(todayStr).toArray();
      const todayTexts = new Set(todayTasks.map(t => t.text));

      for (const task of incomplete) {
        if (!todayTexts.has(task.text)) {
          await db.tasks.add({
            ...task,
            id: uid(),
            date: todayStr,
            createdAt: Date.now(),
            completed: false,
            missed: true,
            missedFromDate: task.missedFromDate || task.date,
          });
        }
      }
    }
    localStorage.setItem(key, '1');
  }

  const showNav = screen !== 'greet';
  const showHeader = screen !== 'greet' && screen !== 'settings' && screen !== 'dashboard';

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>
      {showHeader && (
        <Header title="" showSettings={true} showGreet={false} />
      )}

      {/* Viewing-past-day banner */}
      {isViewingPast && screen !== 'greet' && (
        <div style={{
          position: 'sticky', top: showHeader ? 54 : 0, zIndex: 20,
          background: '#F5C040', padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#3D2000' }}>
            📅 Viewing {viewingDate}
          </span>
          <button onClick={() => setViewingDate(todayStr)} style={{
            background: '#3D2000', color: '#F5C040', border: 'none', borderRadius: 8,
            padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            Return to Today
          </button>
        </div>
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
