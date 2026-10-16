import type { Shape } from '@/lib/symbols';

const PATHS: Record<Shape, React.ReactNode> = {
  circle: <circle cx={7} cy={7} r={5} />,
  ring2: <circle cx={7} cy={7} r={5} strokeDasharray="2 2" fill="none" />,
  triangle: <path d="M7 1.5 L12.5 11.5 L1.5 11.5 Z" />,
  triDown: <path d="M7 12.5 L12.5 2.5 L1.5 2.5 Z" />,
  diamond: <path d="M7 1.5 L12.5 7 L7 12.5 L1.5 7 Z" />,
  square: <rect x={2.5} y={2.5} width={9} height={9} />,
  cross: <path d="M2.5 2.5 L11.5 11.5 M11.5 2.5 L2.5 11.5" strokeWidth={1.6} fill="none" />,
};

/** Glifo de tipo de evento. `kind`: '' sin alerta, 'solid' naranja, 'dark' roja. */
export function Glyph({ shape, kind = '' }: { shape: Shape; kind?: '' | 'solid' | 'dark' }) {
  const fill = kind === 'solid' ? 'var(--color-accent)' : kind === 'dark' ? 'var(--color-accent-900)' : 'rgba(89,128,166,.22)';
  const stroke = kind === 'dark' ? 'var(--color-accent-900)' : 'var(--color-accent-700)';
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill={fill} stroke={stroke} strokeWidth={1} style={{ display: 'block' }} aria-hidden="true">
      {PATHS[shape]}
    </svg>
  );
}
