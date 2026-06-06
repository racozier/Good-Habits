import { useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { db } from '../../db';
import type { Theme } from '../../types';

const THEMES: { id: Theme; name: string; colors: string[]; dark?: boolean }[] = [
  { id: 'warm',       name: 'Warm',        colors: ['#E8916A','#F7DC8A','#C8D5A0','#FDF6EC'] },
  { id: 'cool',       name: 'Cool',        colors: ['#1A3A6E','#2E5DA8','#E87060','#DDE5F5'] },
  { id: 'terracotta', name: 'Terracotta',  colors: ['#C8675A','#E8A87A','#8BAE8E','#F5E8DC'] },
  { id: 'forest',     name: 'Forest',      colors: ['#2A7038','#3E9050','#88C878','#D8EED8'] },
  { id: 'navycoral',  name: 'Navy Coral',  colors: ['#0A1040','#E8604A','#F5C080','#D8DFF0'] },
  { id: 'darkmoss',   name: 'Dark Moss',   colors: ['#181E18','#C08850','#507858','#222C24'], dark: true },
  { id: 'winegold',   name: 'Wine Gold',   colors: ['#140810','#D07080','#C07830','#201018'], dark: true },
  { id: 'linensteel', name: 'Linen Steel', colors: ['#2060A0','#3880C0','#B0C8E0','#E8E0CC'] },
  { id: 'teal',       name: 'Teal',        colors: ['#00A890','#10C8B0','#80D8CE','#C8F0EC'] },
  { id: 'oceanfire',  name: 'Ocean Fire',  colors: ['#0068A0','#0088C8','#F06800','#D0E8F8'] },
  { id: 'amber',      name: 'Amber',       colors: ['#E05800','#E89830','#FFE890','#FAECD8'] },
  { id: 'seafoam',    name: 'Seafoam',     colors: ['#1E6888','#38A870','#C0F0D8','#D8F0E8'] },
];

export default function SettingsScreen() {
  const { theme, setTheme } = useAppStore();
  const importRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState('');

  async function exportData() {
    const [tasks, diary, sleep, books, waterEntries, weightEntries,
           walkEntries, cleaningEntries, workoutEntries, workoutGoal,
           rewards, favoriteBook, daySettings, appSettings, bookNotes,
           readingEntries, lifeGoals, fastingEntries, incomeEntries] = await Promise.all([
      db.tasks.toArray(), db.diaryEntries.toArray(), db.sleepEntries.toArray(),
      db.books.toArray(), db.waterEntries.toArray(), db.weightEntries.toArray(),
      db.walkEntries.toArray(), db.cleaningEntries.toArray(),
      db.workoutEntries.toArray(), db.workoutGoal.toArray(),
      db.rewards.toArray(), db.favoriteBook.toArray(),
      db.daySettings.toArray(), db.appSettings.toArray(),
      db.bookNotes.toArray(), db.readingEntries.toArray(),
      db.lifeGoals.toArray(), db.fastingEntries.toArray(), db.incomeEntries.toArray(),
    ]);
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks, diary, sleep, books, waterEntries, weightEntries,
      walkEntries, cleaningEntries, workoutEntries, workoutGoal,
      rewards, favoriteBook, daySettings, appSettings, bookNotes, readingEntries, lifeGoals,
      fastingEntries, incomeEntries,
      localStorage: Object.fromEntries(
        Array.from({ length: localStorage.length }, (_, i) => {
          const k = localStorage.key(i)!;
          return [k, localStorage.getItem(k)];
        })
      ),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bloomia-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }

  async function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('Importing…');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version) throw new Error('Not a valid Bloomia backup file');

      // Restore all tables
      const ops: Promise<any>[] = [];
      if (data.tasks?.length)          ops.push(db.tasks.bulkPut(data.tasks));
      if (data.diary?.length)          ops.push(db.diaryEntries.bulkPut(data.diary));
      if (data.sleep?.length)          ops.push(db.sleepEntries.bulkPut(data.sleep));
      if (data.books?.length)          ops.push(db.books.bulkPut(data.books));
      if (data.waterEntries?.length)   ops.push(db.waterEntries.bulkPut(data.waterEntries));
      if (data.weightEntries?.length)  ops.push(db.weightEntries.bulkPut(data.weightEntries));
      if (data.walkEntries?.length)    ops.push(db.walkEntries.bulkPut(data.walkEntries));
      if (data.cleaningEntries?.length) ops.push(db.cleaningEntries.bulkPut(data.cleaningEntries));
      if (data.workoutEntries?.length) ops.push(db.workoutEntries.bulkPut(data.workoutEntries));
      if (data.workoutGoal?.length)    ops.push(db.workoutGoal.bulkPut(data.workoutGoal));
      if (data.rewards?.length)        ops.push(db.rewards.bulkPut(data.rewards));
      if (data.favoriteBook?.length)   ops.push(db.favoriteBook.bulkPut(data.favoriteBook));
      if (data.daySettings?.length)    ops.push(db.daySettings.bulkPut(data.daySettings));
      if (data.appSettings?.length)    ops.push(db.appSettings.bulkPut(data.appSettings));
      if (data.bookNotes?.length)      ops.push(db.bookNotes.bulkPut(data.bookNotes));
      if (data.readingEntries?.length) ops.push(db.readingEntries.bulkPut(data.readingEntries));
      if (data.fastingEntries?.length) ops.push(db.fastingEntries.bulkPut(data.fastingEntries));
      if (data.incomeEntries?.length)  ops.push(db.incomeEntries.bulkPut(data.incomeEntries));
      if (data.lifeGoals?.length) {
        ops.push(db.lifeGoals.clear().then(() => db.lifeGoals.bulkPut(data.lifeGoals)));
      }

      // Restore localStorage (streaks, reward claims, bookmarks, theme)
      if (data.localStorage) {
        for (const [k, v] of Object.entries(data.localStorage)) {
          if (typeof v === 'string') localStorage.setItem(k, v);
        }
      }

      await Promise.all(ops);
      setImportStatus('✓ Import successful! Reload the app to see your data.');
    } catch (err: any) {
      setImportStatus('✗ Import failed: ' + err.message);
    }
    e.target.value = '';
  }

  return (
    <div className="screen" style={{ padding: '0 16px 80px' }}>
      <div style={{ padding: '16px 4px 12px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Settings</h2>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Color Theme</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              style={{
                padding: '12px', borderRadius: 16,
                border: theme === t.id ? `3px solid ${t.colors[0]}` : '2px solid var(--color-border)',
                cursor: 'pointer',
                background: theme === t.id
                  ? (t.dark ? t.colors[0] : t.colors[3])
                  : 'var(--color-bg)',
              }}
            >
              <div style={{ display: 'flex', marginBottom: 8, borderRadius: 8, overflow: 'hidden', height: 28 }}>
                {t.colors.map(c => (
                  <div key={c} style={{ flex: 1, background: c }} />
                ))}
              </div>
              <span style={{ fontSize: 13, fontWeight: theme === t.id ? 700 : 400, color: 'var(--color-text)' }}>
                {t.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>Backup & Restore</p>
        <button className="btn-primary" onClick={exportData} style={{ width: '100%', marginBottom: 10 }}>
          📤 Export backup
        </button>
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer', padding: '13px', border: '1.5px dashed var(--color-border)',
          borderRadius: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-primary)',
        }}>
          📥 Import backup
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importData} />
        </label>
        {importStatus && (
          <p style={{ fontSize: 13, marginTop: 10, color: importStatus.startsWith('✓') ? 'green' : importStatus.startsWith('✗') ? '#c44' : 'var(--color-text-muted)', textAlign: 'center' }}>
            {importStatus}
          </p>
        )}
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 18, margin: '0 0 4px' }}>🌸</p>
        <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>Bloomia</p>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>Your daily motivation companion</p>
      </div>
    </div>
  );
}
