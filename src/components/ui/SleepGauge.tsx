export const SLEEP_COLORS = {
  red:   { bg: '#FFCECE', needle: '#E07070', text: '#B04040' },
  green: { bg: '#C4ECC4', needle: '#50A850', text: '#2A7A2A' },
  blue:  { bg: '#B8D8FF', needle: '#4888D8', text: '#1850A0' },
} as const;

export type SleepZone = keyof typeof SLEEP_COLORS;

export function getSleepZone(totalMins: number): SleepZone {
  const h = totalMins / 60;
  if (h < 7)    return 'red';
  if (h <= 9.5) return 'green';
  return 'blue';
}

export function formatSleepLabel(zone: SleepZone): string {
  if (zone === 'red')   return 'Below optimal';
  if (zone === 'green') return 'Well rested';
  return 'Oversleep zone';
}

/**
 * Semi-circular gauge with three coloured zones and an animated needle.
 * totalMins: total minutes of sleep
 * size: 'sm' for a compact version (monthly summary), 'md' for normal (dashboard)
 */
export function SleepGauge({ totalMins, size = 'md' }: { totalMins: number; size?: 'sm' | 'md' }) {
  const zone = getSleepZone(totalMins);
  const col = SLEEP_COLORS[zone];
  const needleRot = zone === 'red' ? -62 : zone === 'green' ? 0 : 62;

  const dim = '#E8E8E8';
  const w = size === 'sm' ? 70 : 88;
  const h = size === 'sm' ? 44 : 55;

  // Fixed viewBox coords: cx=50, cy=60, outer r=48, inner r=32
  // Boundary points at α=60: outer(26,18.4) inner(34,32.3)
  // Boundary points at α=120: outer(74,18.4) inner(66,32.3)
  const zones: { zone: SleepZone; d: string; fill: string }[] = [
    { zone: 'red',   d: 'M 2 60 A 48 48 0 0 1 26 18.4 L 34 32.3 A 32 32 0 0 0 18 60 Z',       fill: '#FFCECE' },
    { zone: 'green', d: 'M 26 18.4 A 48 48 0 0 1 74 18.4 L 66 32.3 A 32 32 0 0 0 34 32.3 Z',   fill: '#C4ECC4' },
    { zone: 'blue',  d: 'M 74 18.4 A 48 48 0 0 1 98 60 L 82 60 A 32 32 0 0 0 66 32.3 Z',       fill: '#B8D8FF' },
  ];

  return (
    <svg viewBox="0 0 100 62" style={{ width: w, height: h, flexShrink: 0 }}>
      {zones.map(z => (
        <path key={z.zone} d={z.d} fill={z.zone === zone ? z.fill : dim} />
      ))}
      <line x1="26" y1="18.4" x2="34" y2="32.3" stroke="white" strokeWidth="1.5" />
      <line x1="74" y1="18.4" x2="66" y2="32.3" stroke="white" strokeWidth="1.5" />
      <g style={{
        transform: `rotate(${needleRot}deg)`,
        transformOrigin: '50px 60px',
        transition: 'transform 0.9s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <line x1="50" y1="60" x2="50" y2="24"
          stroke={col.needle} strokeWidth={size === 'sm' ? 2.5 : 3.5} strokeLinecap="round" />
      </g>
      <circle cx="50" cy="60" r={size === 'sm' ? 4 : 5} fill={col.needle} />
    </svg>
  );
}
