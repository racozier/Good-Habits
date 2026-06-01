import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cloud, Sun, CloudRain, Wind } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatDate, today } from '../../utils/dateUtils';
import { db } from '../../db';

const QUOTES = [
  "Small steps every day lead to extraordinary results.",
  "You don't have to be perfect to be amazing.",
  "Progress is more important than perfection.",
  "Every morning is a chance to begin again.",
  "The secret to getting ahead is getting started.",
  "You are stronger than you think.",
  "Consistency beats motivation every time.",
  "Today is full of possibility.",
  "Your effort today is building your future.",
  "Be proud of how far you've come.",
  "The best time to start is now.",
  "Small consistent actions create massive results.",
  "You have everything you need within you.",
  "Make today count.",
  "Growth is uncomfortable — and worth it.",
];

const PHOTOS = [
  'pic1.jpg','pic2.avif','pic3.avif','pic4.jpg','pic5.jpg',
  'pic6.jpeg','pic7.avif','pic8.jpg','pic9.jpg','pic10.webp',
  'pic11.jpg','pic12.avif','pic13.jpg','pic14.jpg','pic15.jpg',
  'pic16.webp','pic17.avif','pic18.jpg','pic19.avif','pic20.webp',
  'pic21.webp',
];

function getDailyPhoto(): string {
  const d = new Date();
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  const idx = dayOfYear % PHOTOS.length;
  return `${import.meta.env.BASE_URL}assets/${PHOTOS[idx]}`;
}

function getDailyQuote(): string {
  const now = new Date();
  const hour = now.getHours();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  // 0=morning (5-11), 1=afternoon (12-17), 2=evening (18+/before 5)
  const slot = hour >= 5 && hour < 12 ? 0 : hour >= 12 && hour < 18 ? 1 : 2;
  const idx = (dayOfYear * 3 + slot) % QUOTES.length;
  return QUOTES[idx];
}

interface Weather { temp: number; code: number; description: string; }

function weatherIcon(code: number) {
  if (code === 0) return <Sun size={22} color="#F7DC8A" />;
  if (code <= 3) return <Cloud size={22} color="rgba(255,255,255,0.8)" />;
  if (code <= 67) return <CloudRain size={22} color="rgba(255,255,255,0.8)" />;
  return <Wind size={22} color="rgba(255,255,255,0.8)" />;
}

function weatherDesc(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code <= 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain showers';
  return 'Stormy';
}

export default function GreetScreen() {
  const { navigate, energyLevel, setEnergyLevel } = useAppStore();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [photoUrl] = useState(getDailyPhoto());
  const [wakeTime, setWakeTime] = useState('');

  useEffect(() => {
    // Pre-fill wake time if already saved today
    db.daySettings.get(today()).then(ds => {
      if (ds?.wakeTime) setWakeTime(ds.wakeTime);
    });
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
        );
        const data = await res.json();
        const cw = data.current_weather;
        setWeather({ temp: Math.round(cw.temperature), code: cw.weathercode, description: weatherDesc(cw.weathercode) });
      } catch { /* weather unavailable */ }
    }, () => { /* location denied */ });
  }, []);

  async function startDay() {
    const existing = await db.daySettings.get(today());
    const payload = { date: today(), energyLevel, greetShown: true, ...(wakeTime ? { wakeTime } : {}) };
    if (existing) await db.daySettings.update(today(), payload);
    else await db.daySettings.put(payload);
    navigate('dashboard');
  }

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', overflow: 'hidden' }}>
      {/* Full-screen background photo */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `url(${photoUrl})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />

      {/* Dark gradient overlay for readability */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.20) 40%, rgba(0,0,0,0.60) 100%)',
      }} />

      {/* Content overlay */}
      <div style={{
        position: 'relative', zIndex: 2,
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        padding: '0 24px',
      }}>
        {/* Top: Bloomia + weather */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: -0.5, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              Bloomia
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              Grow every day
            </p>
          </div>
          {weather && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,0,0,0.35)', borderRadius: 20, padding: '6px 14px',
              backdropFilter: 'blur(8px)',
            }}>
              {weatherIcon(weather.code)}
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {weather.temp}° · {weather.description}
              </span>
            </div>
          )}
        </motion.div>

        {/* Middle: greeting + quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}
        >
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 15, color: 'rgba(255,255,255,0.75)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {formatDate(today())}
            </p>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.5)', lineHeight: 1.15 }}>
              Hello, Ada! 👋
            </h1>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: '18px 20px',
            backdropFilter: 'blur(12px)', borderLeft: '3px solid rgba(255,255,255,0.5)',
          }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Today's inspiration
            </p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: '#fff', lineHeight: 1.55, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              "{getDailyQuote()}"
            </p>
          </div>
        </motion.div>

        {/* Bottom: energy + start button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 40px)', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div style={{
            background: 'rgba(0,0,0,0.40)', borderRadius: 16, padding: '16px 18px',
            backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {/* Wake-up time */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>🌅 Wake-up time</span>
                {wakeTime && <span style={{ fontSize: 13, fontWeight: 700, color: '#AAE8DF' }}>{wakeTime}</span>}
              </div>
              <input
                type="time"
                value={wakeTime}
                onChange={e => setWakeTime(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 15,
                  outline: 'none', colorScheme: 'dark',
                }}
              />
            </div>

            {/* Energy level */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>⚡ Energy level</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#F7DC8A' }}>{energyLevel}/10</span>
              </div>
              <input
                type="range" min={1} max={10} value={energyLevel}
                onChange={e => setEnergyLevel(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#F7DC8A', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                <span>😴 Low</span>
                <span>⚡ High</span>
              </div>
            </div>
          </div>

          <button
            onClick={startDay}
            style={{
              width: '100%', padding: '18px', borderRadius: 18, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.92)', fontSize: 17, fontWeight: 700,
              color: '#3D2B1F', backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            }}
          >
            Start your day ✨
          </button>
        </motion.div>
      </div>
    </div>
  );
}
