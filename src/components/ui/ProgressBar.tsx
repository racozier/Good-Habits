import { motion } from 'framer-motion';

interface Props {
  value: number;
  label?: string;
  height?: number;
  color?: string;
  showPercent?: boolean;
}

export default function ProgressBar({ value, label, height = 10, color, showPercent = true }: Props) {
  return (
    <div>
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{label}</span>}
          {showPercent && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{value}%</span>}
        </div>
      )}
      <div style={{
        height, borderRadius: height, background: 'var(--color-border)',
        overflow: 'hidden', width: '100%'
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: height,
            background: color || 'var(--color-primary)',
          }}
        />
      </div>
    </div>
  );
}
