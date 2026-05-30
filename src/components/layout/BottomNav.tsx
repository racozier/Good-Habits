import { Home, CheckSquare, Heart, BookOpen, Calendar, BookMarked } from 'lucide-react';
import { useAppStore, type Screen } from '../../store/appStore';

const tabs: { icon: React.FC<any>; label: string; screen: Screen }[] = [
  { icon: Home, label: 'Home', screen: 'dashboard' },
  { icon: CheckSquare, label: 'Tasks', screen: 'tasks' },
  { icon: Heart, label: 'Health', screen: 'health' },
  { icon: BookOpen, label: 'Books', screen: 'books' },
  { icon: Calendar, label: 'Calendar', screen: 'calendar' },
  { icon: BookMarked, label: 'Diary', screen: 'diary' },
];

export default function BottomNav() {
  const { screen, navigate } = useAppStore();
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      display: 'flex', zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map(({ icon: Icon, label, screen: s }) => {
        const active = screen === s;
        return (
          <button key={s} onClick={() => navigate(s)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 0 8px', background: 'none', border: 'none', cursor: 'pointer',
            color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span style={{ fontSize: 10, marginTop: 3, fontWeight: active ? 700 : 400 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
