import { Settings, Sun } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

interface Props { title: string; showSettings?: boolean; showGreet?: boolean; }

export default function Header({ title, showSettings = true, showGreet = false }: Props) {
  const { navigate } = useAppStore();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px 8px', position: 'sticky', top: 0,
      background: 'var(--color-bg)', zIndex: 10,
    }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{title}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {showGreet && (
          <button onClick={() => navigate('greet')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
            <Sun size={22} color="var(--color-primary)" />
          </button>
        )}
        {showSettings && (
          <button onClick={() => navigate('settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
            <Settings size={22} color="var(--color-text-muted)" />
          </button>
        )}
      </div>
    </div>
  );
}
