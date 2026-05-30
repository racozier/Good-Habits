import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { db } from '../../db';
import { today, uid } from '../../utils/dateUtils';
import type { LifeGoal, TaskColor, Difficulty } from '../../types';

const COLORS: Record<TaskColor, string> = {
  physical: '#F5A07A', stress: '#E8916A', growth: '#5B9EA0', environment: '#C8D5A0', general: '#F7DC8A'
};
const DIFF_LABELS: Record<Difficulty, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

const CATEGORY_LABELS: Record<TaskColor, string> = {
  physical: '💪 Physical', stress: '⚡ Challenge', growth: '🌱 Growth',
  environment: '🌿 Environment', general: '⭐ General'
};

export default function LifeProgressScreen() {
  const [goals, setGoals] = useState<LifeGoal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addedToday, setAddedToday] = useState<Set<string>>(new Set());
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState<TaskColor>('growth');
  const [newDiff, setNewDiff] = useState<Difficulty>(1);

  useEffect(() => { loadGoals(); checkAddedToday(); }, []);

  async function loadGoals() {
    const g = await db.lifeGoals.toArray();
    setGoals(g);
  }

  async function checkAddedToday() {
    const tasks = await db.tasks.where('date').equals(today()).toArray();
    const texts = new Set(tasks.map(t => t.text));
    setAddedToday(texts);
  }

  async function addToToday(goal: LifeGoal) {
    const exists = await db.tasks.where('date').equals(today()).toArray();
    if (exists.find(t => t.text === goal.text)) return;
    await db.tasks.add({
      id: uid(), text: goal.text, difficulty: goal.difficulty, color: goal.category,
      completed: false, isRecurring: false, date: today(), createdAt: Date.now()
    });
    checkAddedToday();
  }

  async function addCustomGoal() {
    if (!newText.trim()) return;
    await db.lifeGoals.add({ id: uid(), text: newText.trim(), category: newCat, difficulty: newDiff });
    setNewText(''); setShowAdd(false); loadGoals();
  }

  async function deleteGoal(id: string) {
    await db.lifeGoals.delete(id);
    loadGoals();
  }

  const grouped = goals.reduce<Partial<Record<TaskColor, LifeGoal[]>>>((acc, g) => {
    (acc[g.category] ??= []).push(g);
    return acc;
  }, {});

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Life Goals</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>Tap any goal to add it to today's tasks</p>
        </div>
        <button onClick={() => setShowAdd(s => !s)} style={{
          background: 'var(--color-primary)', border: 'none', borderRadius: 12, padding: '8px 14px',
          color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14
        }}>
          <Plus size={16} /> Add
        </button>
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="New life goal..." value={newText}
            onChange={e => setNewText(e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {(Object.entries(CATEGORY_LABELS) as [TaskColor, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setNewCat(id)} style={{
                padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
                background: newCat === id ? COLORS[id] : 'var(--color-bg)', fontWeight: newCat === id ? 700 : 400
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {([1, 2, 3] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setNewDiff(d)} style={{
                flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13,
                background: newDiff === d ? 'var(--color-primary)' : 'var(--color-bg)', color: newDiff === d ? 'white' : 'var(--color-text)'
              }}>{DIFF_LABELS[d]}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={addCustomGoal} style={{ flex: 1 }}>Add Goal</button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </motion.div>
      )}

      {(Object.entries(grouped) as [TaskColor, LifeGoal[]][]).map(([category, categoryGoals]) => (
        <div key={category} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, paddingLeft: 4 }}>
            {CATEGORY_LABELS[category]}
          </p>
          {categoryGoals.map(goal => {
            const done = addedToday.has(goal.text);
            return (
              <motion.div key={goal.id} layout style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                background: 'var(--color-surface)', borderRadius: 14, marginBottom: 8,
                borderLeft: `4px solid ${COLORS[goal.category]}`,
                opacity: done ? 0.7 : 1, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
              }}>
                <button onClick={() => addToToday(goal)} style={{
                  flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0
                }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--color-text)' }}>{goal.text}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {DIFF_LABELS[goal.difficulty]} · {goal.difficulty}pt
                    </span>
                    {done && <span style={{ fontSize: 11, color: 'green' }}>✓ Added today</span>}
                  </div>
                </button>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!done && (
                    <button onClick={() => addToToday(goal)} style={{
                      background: 'var(--color-primary)', border: 'none', borderRadius: 8, padding: '6px 12px',
                      color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 600
                    }}>
                      + Add
                    </button>
                  )}
                  <button onClick={() => deleteGoal(goal.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={15} color="var(--color-text-muted)" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ))}

      {goals.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
          <Sparkles size={40} style={{ margin: '0 auto 12px' }} />
          <p>Add life goals to inspire your daily tasks</p>
        </div>
      )}
    </div>
  );
}
