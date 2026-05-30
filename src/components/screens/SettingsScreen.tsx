import { Sun, Moon } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { db } from '../../db';

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
        <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Color Theme</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setTheme('warm')} style={{
            flex: 1, padding: 16, borderRadius: 16, border: theme === 'warm' ? '3px solid var(--color-primary)' : '2px solid var(--color-border)',
            cursor: 'pointer', background: theme === 'warm' ? 'var(--color-secondary)' : 'var(--color-bg)'
          }}>
            <div style={{ display: 'flex', marginBottom: 8, borderRadius: 8, overflow: 'hidden', height: 32 }}>
              {['#E8916A', '#F7DC8A', '#C8D5A0', '#5B9EA0'].map(c => (
                <div key={c} style={{ flex: 1, background: c }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <Sun size={16} />
              <span style={{ fontSize: 14, fontWeight: theme === 'warm' ? 700 : 400 }}>Warm</span>
            </div>
          </button>
          <button onClick={() => setTheme('cool')} style={{
            flex: 1, padding: 16, borderRadius: 16, border: theme === 'cool' ? '3px solid var(--color-primary)' : '2px solid var(--color-border)',
            cursor: 'pointer', background: theme === 'cool' ? 'var(--color-accent)' : 'var(--color-bg)'
          }}>
            <div style={{ display: 'flex', marginBottom: 8, borderRadius: 8, overflow: 'hidden', height: 32 }}>
              {['#0D1B4B', '#1A8A9A', '#F5D5A8', '#F5A07A'].map(c => (
                <div key={c} style={{ flex: 1, background: c }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <Moon size={16} />
              <span style={{ fontSize: 14, fontWeight: theme === 'cool' ? 700 : 400 }}>Cool</span>
            </div>
          </button>
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
