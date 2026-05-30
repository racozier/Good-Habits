import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface Props {
  minutes: number;
  onComplete?: () => void;
  label?: string;
}

export default function CountdownTimer({ minutes, onComplete, label }: Props) {
  const totalSeconds = minutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            onComplete?.();
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const reset = () => { setRemaining(totalSeconds); setRunning(false); };
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const pct = ((totalSeconds - remaining) / totalSeconds) * 100;

  return (
    <div className="card" style={{ textAlign: 'center', padding: 20 }}>
      {label && <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>{label}</p>}
      <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 16px' }}>
        <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={60} cy={60} r={50} fill="none" stroke="var(--color-border)" strokeWidth={8} />
          <circle cx={60} cy={60} r={50} fill="none" stroke="var(--color-primary)" strokeWidth={8}
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 26, fontWeight: 700, color: 'var(--color-text)'
        }}>
          {mm}:{ss}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button className="btn-ghost" onClick={reset} style={{ padding: '10px 14px' }}>
          <RotateCcw size={18} />
        </button>
        <button className="btn-primary" onClick={() => setRunning(r => !r)} style={{ minWidth: 80 }}>
          {running ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>
    </div>
  );
}
