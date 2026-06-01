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

  async function exportData() {
    const [tasks, diary, sleep, books] = await Promise.all([
      db.tasks.toArray(), db.diaryEntries.toArray(),
      db.sleepEntries.toArray(), db.books.toArray()
    ]);
    const blob = new Blob([JSON.stringify({ tasks, diary, sleep, books }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bloomia-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
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
        <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>Data</p>
        <button className="btn-ghost" onClick={exportData} style={{ width: '100%' }}>
          📥 Export all data as JSON
        </button>
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 18, margin: '0 0 4px' }}>🌸</p>
        <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>Bloomia</p>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>Your daily motivation companion</p>
      </div>
    </div>
  );
}
