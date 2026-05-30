import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X } from 'lucide-react';
import { db } from '../../db';
import type { Reward } from '../../types';

interface Props {
  open: boolean;
  tier: 1 | 2 | 3 | 4;
  energyLevel: number;
  onClose: () => void;
}

const TIER_MESSAGES: Record<number, string> = {
  1: 'Great start! You\'ve earned a reward! 🌱',
  2: 'Halfway there! Keep it up! ⭐',
  3: 'Almost done! So proud of you! 🏅',
  4: 'You crushed it today! 🏆',
};

const CONFETTI_COLORS = ['#E8916A','#F7DC8A','#C8D5A0','#5B9EA0','#F5A07A','#9B8EC4','#6BAED6'];

function ConfettiPiece({ color, left, delay, duration }: { color: string; left: number; delay: number; duration: number }) {
  return (
    <div style={{
      position: 'fixed',
      left: `${left}%`,
      top: -12,
      width: 10,
      height: 10,
      borderRadius: Math.random() > 0.5 ? '50%' : 2,
      background: color,
      animation: `confetti-fall ${duration}s ease-in ${delay}s forwards, confetti-sway ${duration * 0.4}s ease-in-out ${delay}s infinite`,
      zIndex: 1100,
      pointerEvents: 'none',
    }} />
  );
}

export default function RewardPopup({ open, tier, energyLevel, onClose }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [chosen, setChosen] = useState<Reward | null>(null);

  useEffect(() => {
    if (open) {
      db.rewards.where('tier').equals(tier).toArray().then(setRewards);
      setChosen(null);
    }
  }, [open, tier]);

  const energyMult = energyLevel <= 4 ? 0.7 : energyLevel <= 7 ? 1 : 1.3;

  const confettiPieces = useMemo(() => (
    Array.from({ length: 45 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2 + Math.random() * 1.5,
    }))
  ), [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Confetti */}
          {confettiPieces.map(p => (
            <ConfettiPiece key={p.id} color={p.color} left={p.left} delay={p.delay} duration={p.duration} />
          ))}

          {/* Backdrop + centered flex container */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={chosen ? onClose : undefined}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
              zIndex: 1050, backdropFilter: 'blur(3px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 20px',
            }}
          >
          {/* Modal — stop click propagating to backdrop */}
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            style={{
              width: '100%', maxWidth: 400,
              background: 'var(--color-surface)', borderRadius: 24,
              padding: '28px 24px 24px', textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <button onClick={onClose} style={{
              position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer'
            }}>
              <X size={20} color="var(--color-text-muted)" />
            </button>

            {!chosen ? (
              <>
                <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: 'var(--color-text)' }}>
                  Congratulations, Ada!
                </h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 15, margin: '0 0 20px' }}>
                  {TIER_MESSAGES[tier]}
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 12px' }}>
                  Choose your reward:
                </p>
                {rewards.length === 0 && (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
                    No rewards set for this tier yet — go to Rewards to add some!
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rewards.map(r => {
                    const mins = Math.round(r.durationMinutes * energyMult);
                    return (
                      <button key={r.id} onClick={() => setChosen(r)} style={{
                        padding: '14px 16px', borderRadius: 14,
                        border: '2px solid var(--color-border)',
                        background: 'var(--color-bg)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'border-color 0.15s', textAlign: 'left',
                      }}>
                        <Gift size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>{r.text}</p>
                          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>{mins} minutes</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button onClick={onClose} className="btn-ghost" style={{ width: '100%', marginTop: 14 }}>
                  Claim later
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 60, marginBottom: 12 }}>🛋️</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: 'var(--color-text)' }}>
                  Enjoy your reward!
                </h2>
                <div style={{
                  background: 'var(--color-secondary)', borderRadius: 16, padding: '16px 20px', margin: '12px 0 20px'
                }}>
                  <p style={{ fontWeight: 700, fontSize: 17, margin: '0 0 4px', color: 'var(--color-text)' }}>{chosen.text}</p>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-muted)' }}>
                    {Math.round(chosen.durationMinutes * energyMult)} minutes — you deserve it! 💛
                  </p>
                </div>
                <button className="btn-primary" onClick={onClose} style={{ width: '100%', fontSize: 16 }}>
                  Let's go! ✨
                </button>
              </>
            )}
          </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
