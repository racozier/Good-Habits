import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Upload, Lock, BookOpen } from 'lucide-react';
import JSZip from 'jszip';
import { db } from '../../db';
import { uid } from '../../utils/dateUtils';
import type { Reward, FavoriteBook } from '../../types';
import { useAppStore } from '../../store/appStore';

async function countEpubChapters(dataUrl: string): Promise<number> {
  try {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    const zip = await JSZip.loadAsync(buf.buffer);
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) return 20;
    const containerXml = await containerFile.async('string');
    const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1] ?? '';
    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const opfXml = await zip.file(opfPath)!.async('string');
    const manifest: Record<string, string> = {};
    for (const m of opfXml.matchAll(/<item\s[^>]*\bid="([^"']+)"[^>]*\bhref="([^"']+)"/g)) manifest[m[1]] = m[2];
    let spineIds = [...opfXml.matchAll(/<itemref\s[^>]*\bidref="([^"]+)"/g)].map(m => m[1]);
    if (!spineIds.length) spineIds = [...opfXml.matchAll(/idref=['"]([^'"]+)['"]/g)].map(m => m[1]);
    const paths = spineIds.map(id => manifest[id]).filter(Boolean).map(h => opfDir + h);
    if (!paths.length) return 20;

    // Try Roman numeral detection — if reasonable fraction found, use that count
    const ROMAN_RE = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
    const isRoman = (s: string) => s.trim().length > 0 && s.trim().length <= 12 && ROMAN_RE.test(s.trim());
    let romanCount = 0;
    const seen = new Set<string>();
    for (const p of paths) {
      const f = zip.file(p) ?? zip.file(p.replace(/^\//, ''));
      if (!f) continue;
      const raw = await f.async('string');
      const body = raw.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<[^>]+>/g, ' ');
      const words = body.split(/\s+/).filter(Boolean);
      for (const w of words.slice(0, 20)) {
        if (isRoman(w)) { const k = w.toUpperCase(); if (!seen.has(k)) { seen.add(k); romanCount++; } break; }
      }
    }
    // Only trust Roman numeral count if it covers at least 30% of spine items
    if (romanCount > 0 && romanCount >= paths.length * 0.3) return romanCount;
    return paths.length;
  } catch { return 20; }
}

const TIER_LABELS = ['', '< 25% done', '25–49% done', '50–74% done', '75–100% done'];
const TIER_EMOJIS = ['', '🌱', '⭐', '🏅', '🏆'];

export default function RewardsScreen() {
  const { energyLevel, openEpub } = useAppStore();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [favoriteBook, setFavoriteBook] = useState<FavoriteBook | null>(null);
  const [showAdd, setShowAdd] = useState<number | null>(null);
  const [newText, setNewText] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [addingTier, setAddingTier] = useState<1 | 2 | 3 | 4>(1);
  const [pendingEpub, setPendingEpub] = useState<{ data: string; defaultName: string } | null>(null);
  const [epubTitle, setEpubTitle] = useState('');

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
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      const defaultName = file.name.replace(/\.epub$/i, '');
      setPendingEpub({ data, defaultName });
      setEpubTitle(defaultName);
    };
    reader.readAsDataURL(file);
  }

  async function confirmEpubUpload() {
    if (!pendingEpub) return;
    const title = epubTitle.trim() || pendingEpub.defaultName;
    const existing = await db.favoriteBook.get('favorite');
    const totalChapters = await countEpubChapters(pendingEpub.data);
    const fb: FavoriteBook = {
      id: 'favorite', title, epubData: pendingEpub.data,
      totalChapters, unlockedChapters: 0,
      bankedChapters: existing?.bankedChapters ?? 0,
    };
    await db.favoriteBook.put(fb);
    setPendingEpub(null);
    loadFavoriteBook();
  }

  async function redeemBanked() {
    if (!favoriteBook || !favoriteBook.bankedChapters) return;
    const banked = favoriteBook.bankedChapters;
    const remaining = favoriteBook.totalChapters - favoriteBook.unlockedChapters;
    const actualUnlock = Math.min(banked, remaining);
    const newBanked = banked - actualUnlock;
    await db.favoriteBook.update('favorite', {
      unlockedChapters: favoriteBook.unlockedChapters + actualUnlock,
      bankedChapters: newBanked,
    });
    loadFavoriteBook();
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
        {/* Rename/upload modal */}
        <AnimatePresence>
          {pendingEpub && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px'
              }}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                style={{ background: 'var(--color-surface)', borderRadius: 20, padding: '24px 20px', width: '100%', maxWidth: 380 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Name your book</h3>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>Give your EPUB a clean name</p>
                <input className="input" value={epubTitle} onChange={e => setEpubTitle(e.target.value)}
                  placeholder="Book title..." style={{ marginBottom: 14, width: '100%' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={confirmEpubUpload} style={{ flex: 1 }}>Save</button>
                  <button className="btn-ghost" onClick={() => setPendingEpub(null)}>Cancel</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {favoriteBook ? (
          <div>
            <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 4px' }}>{favoriteBook.title}</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
              1 chapter unlocked per reward tier reached (max 4)
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Array.from({ length: favoriteBook.totalChapters }).map((_, i) => {
                const unlocked = i < favoriteBook.unlockedChapters;
                return (
                  <button key={i} onClick={() => unlocked && favoriteBook && openEpub({ data: favoriteBook.epubData, title: favoriteBook.title, startChapter: i, returnScreen: 'rewards' })}
                    style={{
                      width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexDirection: 'column', gap: 2,
                      background: unlocked ? 'var(--color-secondary)' : 'var(--color-bg)',
                      color: unlocked ? 'var(--color-text)' : 'var(--color-text-muted)',
                      border: unlocked ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                      cursor: unlocked ? 'pointer' : 'default',
                      padding: 0,
                    }}>
                    {unlocked ? <BookOpen size={14} /> : <Lock size={13} />}
                    <span style={{ fontSize: 9, fontWeight: 700 }}>{i + 1}</span>
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
              {favoriteBook.unlockedChapters} / {favoriteBook.totalChapters} chapters unlocked
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                fontSize: 13, color: 'var(--color-primary)', fontWeight: 600
              }}>
                <Upload size={14} /> Replace EPUB
                <input type="file" accept=".epub" style={{ display: 'none' }} onChange={handleFavBookUpload} />
              </label>
              {(favoriteBook.bankedChapters ?? 0) > 0 && (
                <button onClick={redeemBanked} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  fontSize: 13, color: '#F5A07A', fontWeight: 700,
                  background: 'rgba(245,160,122,0.12)', border: '1.5px solid rgba(245,160,122,0.4)',
                  borderRadius: 8, padding: '5px 10px',
                }}>
                  🎁 Redeem {favoriteBook.bankedChapters} banked chapter{favoriteBook.bankedChapters !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              Upload your favorite EPUB book. Chapters unlock as you complete reward tiers — 1 chapter per tier.
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
