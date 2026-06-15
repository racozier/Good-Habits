import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, BookOpen } from 'lucide-react';
import { db } from '../../db';
import type { Reward } from '../../types';

interface Props {
  open: boolean;
  tier: 1 | 2 | 3 | 4;
  energyLevel: number;
  onClose: () => void;
}

const TIER_MESSAGES: Record<number, string> = {
  1: "Great start! You've earned a reward! 🌱",
  2: 'Halfway there! Keep it up! ⭐',
  3: 'Almost done! So proud of you! 🏅',
  4: 'You crushed it today! 🏆',
};

const CONFETTI_COLORS = ['#E8916A','#F7DC8A','#C8D5A0','#5B9EA0','#F5A07A','#9B8EC4','#6BAED6'];

function ConfettiPiece({ color, left, delay, duration }: { color: string; left: number; delay: number; duration: number }) {
  return (
    <div style={{
      position: 'fixed', left: `${left}%`, top: -12, width: 10, height: 10,
      borderRadius: Math.random() > 0.5 ? '50%' : 2, background: color,
      animation: `confetti-fall ${duration}s ease-in ${delay}s forwards, confetti-sway ${duration * 0.4}s ease-in-out ${delay}s infinite`,
      zIndex: 1100, pointerEvents: 'none',
    }} />
  );
}

type View = 'choice' | 'reward-list' | 'chosen' | 'tier4-confirm' | 'tier4-rewards';

async function unlockChapters(count: number) {
  const fb = await db.favoriteBook.get('favorite');
  if (!fb) return;
  const remaining = fb.totalChapters - fb.unlockedChapters;
  const actualUnlock = Math.min(count, remaining);
  const overflow = count - actualUnlock;
  await db.favoriteBook.update('favorite', {
    unlockedChapters: fb.unlockedChapters + actualUnlock,
    bankedChapters: (fb.bankedChapters ?? 0) + overflow,
  });
}

export default function RewardPopup({ open, tier, energyLevel, onClose }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [chosen, setChosen] = useState<Reward | null>(null);
  const [view, setView] = useState<View>('choice');
  const [hasFavBook, setHasFavBook] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChosen(null);

    // tier 2: show choice screen; tier 4: auto-unlock 2 chapters then confirm
    if (tier === 2) {
      setView('choice');
    } else if (tier === 4) {
      setView('tier4-confirm');
      unlockChapters(2);
    } else {
      setView('choice');
    }

    db.rewards.where('tier').equals(tier).toArray().then(setRewards);
    db.favoriteBook.get('favorite').then(fb => setHasFavBook(!!fb));
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

  function handleChooseReward(r: Reward) {
    setChosen(r);
    setView('chosen');
  }

  function renderContent() {
    // Standard tiers (1, 3): pick a reward or close
    if (tier !== 2 && tier !== 4) {
      return view === 'chosen' ? renderChosen() : renderRewardList(rewards, 'choice');
    }

    if (tier === 2) {
      if (view === 'choice') return renderTier2Choice();
      if (view === 'reward-list') return renderRewardList(rewards, 'reward-list');
      if (view === 'chosen') return renderChosen();
    }

    if (tier === 4) {
      if (view === 'tier4-confirm') return renderTier4Confirm();
      if (view === 'tier4-rewards') return renderRewardList(rewards, 'tier4-rewards');
      if (view === 'chosen') return renderChosen();
    }

    return null;
  }

  function renderTier2Choice() {
    return (
      <>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: 'var(--color-text)' }}>
          Halfway there! ⭐
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 15, margin: '0 0 20px' }}>
          You've reached 50%! What would you like?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hasFavBook && (
            <button onClick={() => { unlockChapters(1); setView('chosen'); setChosen({ id: '__chapter__', text: 'Chapter unlocked! 📖', durationMinutes: 0, tier: 2 }); }}
              style={{
                padding: '16px', borderRadius: 14, border: '2px solid var(--color-primary)',
                background: 'var(--color-secondary)', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
              <BookOpen size={22} color="var(--color-primary)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>Unlock a book chapter</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>Unlock 1 chapter of your favorite book</p>
              </div>
            </button>
          )}
          <button onClick={() => setView('reward-list')}
            style={{
              padding: '16px', borderRadius: 14, border: '2px solid var(--color-border)',
              background: 'var(--color-bg)', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
            <Gift size={22} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>Pick a reward</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>Choose from your 50% reward list</p>
            </div>
          </button>
        </div>
        <button onClick={onClose} style={{
          width: '100%', marginTop: 14, padding: '12px', background: 'none',
          border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-muted)',
        }}>
          Later
        </button>
      </>
    );
  }

  function renderTier4Confirm() {
    return (
      <>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🏆</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: 'var(--color-text)' }}>
          You crushed it today!
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 15, margin: '0 0 8px' }}>
          100% complete — incredible work! 🎊
        </p>
        {hasFavBook && (
          <div style={{
            background: 'var(--color-secondary)', borderRadius: 14, padding: '14px 16px', margin: '4px 0 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <BookOpen size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
              2 book chapters unlocked! 📖
            </p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => setView('tier4-rewards')} className="btn-primary" style={{ width: '100%', fontSize: 15 }}>
            🎁 Browse my rewards
          </button>
          <button onClick={onClose} style={{
            width: '100%', padding: '12px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 14, color: 'var(--color-text-muted)',
          }}>
            Close
          </button>
        </div>
      </>
    );
  }

  function renderRewardList(list: Reward[], from: string) {
    return (
      <>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎁</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: 'var(--color-text)' }}>
          Choose your reward
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '0 0 16px' }}>
          {TIER_MESSAGES[tier]}
        </p>
        {list.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
            No rewards set for this tier yet — add some in Rewards!
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '45vh', overflowY: 'auto' }}>
          {list.map(r => {
            const mins = Math.round(r.durationMinutes * energyMult);
            return (
              <button key={r.id} onClick={() => handleChooseReward(r)} style={{
                padding: '14px 16px', borderRadius: 14, border: '2px solid var(--color-border)',
                background: 'var(--color-bg)', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <Gift size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>{r.text}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>{mins} min</p>
                </div>
              </button>
            );
          })}
        </div>
        {from === 'reward-list' && (
          <button onClick={() => setView('choice')} style={{
            width: '100%', marginTop: 12, padding: '10px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)',
          }}>
            ← Back
          </button>
        )}
        {from !== 'reward-list' && (
          <button onClick={onClose} style={{
            width: '100%', marginTop: 12, padding: '10px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)',
          }}>
            Later
          </button>
        )}
      </>
    );
  }

  function renderChosen() {
    const isChapter = chosen?.id === '__chapter__';
    return (
      <>
        <div style={{ fontSize: 60, marginBottom: 12 }}>{isChapter ? '📖' : '🛋️'}</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: 'var(--color-text)' }}>
          {isChapter ? 'Chapter unlocked!' : 'Enjoy your reward!'}
        </h2>
        <div style={{
          background: 'var(--color-secondary)', borderRadius: 16, padding: '16px 20px', margin: '12px 0 20px'
        }}>
          <p style={{ fontWeight: 700, fontSize: 17, margin: '0 0 4px', color: 'var(--color-text)' }}>{chosen?.text}</p>
          {!isChapter && chosen && (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-muted)' }}>
              {Math.round(chosen.durationMinutes * energyMult)} minutes — you deserve it! 💛
            </p>
          )}
          {isChapter && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
              Go to Rewards to read your unlocked chapter
            </p>
          )}
        </div>
        <button className="btn-primary" onClick={onClose} style={{ width: '100%', fontSize: 16 }}>
          Let's go! ✨
        </button>
      </>
    );
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {confettiPieces.map(p => (
            <ConfettiPiece key={p.id} color={p.color} left={p.left} delay={p.delay} duration={p.duration} />
          ))}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
              zIndex: 1050, backdropFilter: 'blur(3px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px',
            }}
          >
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
                position: 'relative',
              }}
            >
              {renderContent()}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
