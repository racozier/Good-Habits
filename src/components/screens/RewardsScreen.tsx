import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Upload, Lock, Unlock } from 'lucide-react';
import { db } from '../../db';
import { uid } from '../../utils/dateUtils';
import type { Reward, FavoriteBook } from '../../types';
import { useAppStore } from '../../store/appStore';

const TIER_LABELS = ['', '< 25% done', '25–49% done', '50–74% done', '75–100% done'];
const TIER_EMOJIS = ['', '🌱', '⭐', '🏅', '🏆'];

export default function RewardsScreen() {
  const { energyLevel } = useAppStore();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [favoriteBook, setFavoriteBook] = useState<FavoriteBook | null>(null);
  const [showAdd, setShowAdd] = useState<number | null>(null);
  const [newText, setNewText] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [addingTier, setAddingTier] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => { loadRewards(); loadFavoriteBook(); }, []);

  async function loadRewards() {
    const r = await db.rewards.toArray();
    setRewards(r);
  }

  async function loadFavoriteBook() {
    const fb = await db.favoriteBook.get('favorite');
    setFavoriteBook(fb || null);
  }

  async function addReward(tier: 1 | 2 | 3 | 4) {
    if (!newText.trim()) return;
    const energyMult = energyLevel <= 4 ? 0.7 : energyLevel <= 7 ? 1 : 1.3;
    const baseDuration = parseInt(newDuration) || 30;
    const reward: Reward = {
      id: uid(), text: newText.trim(),
      durationMinutes: Math.round(baseDuration * energyMult),
      tier
    };
    await db.rewards.add(reward);
    setNewText(''); setNewDuration(''); setShowAdd(null); loadRewards();
  }

  async function deleteReward(id: string) {
    await db.rewards.delete(id);
    loadRewards();
  }

  async function handleFavBookUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = ev.target?.result as string;
      const title = file.name.replace('.epub', '');
      const fb: FavoriteBook = {
        id: 'favorite', title, epubData: data,
        totalChapters: 20, unlockedChapters: 0
      };
      await db.favoriteBook.put(fb);
      loadFavoriteBook();
    };
    reader.readAsDataURL(file);
  }

  const energyLabel = energyLevel <= 4 ? 'Low' : energyLevel <= 7 ? 'Medium' : 'High';
  const energyMult = energyLevel <= 4 ? 0.7 : energyLevel <= 7 ? 1 : 1.3;

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Rewards</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
          Energy: {energyLabel} ({energyLevel}/10) · Reward time ×{energyMult.toFixed(1)}
        </p>
      </div>

      {([1, 2, 3, 4] as const).map(tier => {
        const tierRewards = rewards.filter(r => r.tier === tier);
        return (
          <div key={tier} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
              <span style={{ fontSize: 18 }}>{TIER_EMOJIS[tier]}</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>{TIER_LABELS[tier]}</span>
              <button onClick={() => { setShowAdd(tier); setAddingTier(tier); }} style={{
                marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer'
              }}>
                <Plus size={18} color="var(--color-primary)" />
              </button>
            </div>

            {showAdd === tier && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ marginBottom: 8 }}>
                <input className="input" placeholder="Reward description..." value={newText}
                  onChange={e => setNewText(e.target.value)} style={{ marginBottom: 8 }} />
                <input className="input" type="number" placeholder="Base duration (minutes)" value={newDuration}
                  onChange={e => setNewDuration(e.target.value)} style={{ marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={() => addReward(addingTier)} style={{ flex: 1 }}>Add</button>
                  <button className="btn-ghost" onClick={() => setShowAdd(null)}>Cancel</button>
                </div>
              </motion.div>
            )}

            {tierRewards.map(reward => {
              const adjustedDuration = Math.round(reward.durationMinutes * energyMult);
              return (
                <div key={reward.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: 'var(--color-surface)', borderRadius: 12, marginBottom: 6,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{reward.text}</p>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{adjustedDuration} min</span>
                  </div>
                  <button onClick={() => deleteReward(reward.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={15} color="var(--color-text-muted)" />
                  </button>
                </div>
              );
            })}

            {tierRewards.length === 0 && showAdd !== tier && (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', paddingLeft: 4 }}>No rewards yet · tap + to add</p>
            )}
          </div>
        );
      })}

      {/* Favorite locked book */}
      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>📚</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Favorite Locked Book</span>
        </div>
        {favoriteBook ? (
          <div>
            <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 8px' }}>{favoriteBook.title}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Array.from({ length: favoriteBook.totalChapters }).map((_, i) => {
                const unlocked = i < favoriteBook.unlockedChapters;
                return (
                  <div key={i} style={{
                    width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 11, fontWeight: 600,
                    background: unlocked ? 'var(--color-secondary)' : 'var(--color-bg)',
                    color: unlocked ? 'var(--color-text)' : 'var(--color-text-muted)',
                    border: '1.5px solid var(--color-border)'
                  }}>
                    {unlocked ? <Unlock size={14} /> : <Lock size={14} />}
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
              {favoriteBook.unlockedChapters} / {favoriteBook.totalChapters} chapters unlocked
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              Upload your favorite EPUB book. Chapters unlock as rewards — 1 per reward tier crossed, 3 for completing all tasks.
            </p>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: 'pointer', padding: '14px', border: '1.5px dashed var(--color-border)',
              borderRadius: 12, color: 'var(--color-primary)', fontWeight: 600, fontSize: 14
            }}>
              <Upload size={18} /> Upload EPUB
              <input type="file" accept=".epub" style={{ display: 'none' }} onChange={handleFavBookUpload} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
