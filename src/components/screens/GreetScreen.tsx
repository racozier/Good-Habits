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
];

function getDailyQuote(): string {
  const dayIndex = new Date().getDate() % QUOTES.length;
  return QUOTES[dayIndex];
}

interface Weather { temp: number; code: number; description: string; }

function weatherIcon(code: number) {
  if (code === 0) return <Sun size={28} color="#F7DC8A" />;
  if (code <= 3) return <Cloud size={28} color="#aaa" />;
  if (code <= 67) return <CloudRain size={28} color="#5B9EA0" />;
  return <Wind size={28} color="#aaa" />;
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
  const { navigate } = useAppStore();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) { setWeatherError(true); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
        );
        const data = await res.json();
        const cw = data.current_weather;
        setWeather({ temp: Math.round(cw.temperature), code: cw.weathercode, description: weatherDesc(cw.weathercode) });
      } catch { setWeatherError(true); }
    }, () => setWeatherError(true));
  }, []);

  const gradients = [
    'linear-gradient(135deg, #E8916A 0%, #F7DC8A 50%, #C8D5A0 100%)',
    'linear-gradient(135deg, #5B9EA0 0%, #C8D5A0 50%, #F7DC8A 100%)',
    'linear-gradient(135deg, #F7DC8A 0%, #E8916A 100%)',
    'linear-gradient(135deg, #C8D5A0 0%, #5B9EA0 100%)',
  ];
  const gradient = gradients[new Date().getDay() % gradients.length];

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        style={{ height: '45dvh', background: gradient, position: 'relative', overflow: 'hidden' }}
      >
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'rgba(0,0,0,0.08)'
        }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ fontSize: 48 }}
          >🌸</motion.div>
          {weather && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.3)',
                borderRadius: 20, padding: '6px 16px', backdropFilter: 'blur(8px)' }}
            >
              {weatherIcon(weather.code)}
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 16, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                {weather.temp}° · {weather.description}
              </span>
            </motion.div>
          )}
          {weatherError && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Weather unavailable</div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 4 }}>
            {formatDate(today())}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
            Hello, Ada! 👋
          </h1>
        </div>

        <div style={{
          background: 'var(--color-surface)', borderRadius: 16, padding: '20px',
          borderLeft: '4px solid var(--color-primary)'
        }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6, fontStyle: 'italic' }}>
            Today's inspiration
          </p>
          <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.5, margin: 0 }}>
            "{getDailyQuote()}"
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={async () => {
            await db.daySettings.put({ date: today(), energyLevel: 5, greetShown: true });
            navigate('dashboard');
          }}
          style={{ fontSize: 17, padding: '16px', marginTop: 'auto', borderRadius: 16 }}
        >
          Start your day ✨
        </button>
      </motion.div>
    </div>
  );
}
