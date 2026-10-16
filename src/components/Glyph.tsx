import type { CSSProperties } from 'react';
import type { Shape } from '@/lib/symbols';

const PATHS: Record<Shape, React.ReactNode> = {
  circle: <circle className="shape" cx={7} cy={7} r={5} />,
  ring2: <circle className="shape" cx={7} cy={7} r={5} strokeDasharray="2 2" style={{ fill: 'none' }} />,
  triangle: <path className="shape" d="M7 1.5 L12.5 11.5 L1.5 11.5 Z" />,
  triDown: <path className="shape" d="M7 12.5 L12.5 2.5 L1.5 2.5 Z" />,
  diamond: <path className="shape" d="M7 1.5 L12.5 7 L7 12.5 L1.5 7 Z" />,
  square: <rect className="shape" x={2.5} y={2.5} width={9} height={9} />,
  cross: <path className="shape" d="M2.5 2.5 L11.5 11.5 M11.5 2.5 L2.5 11.5" style={{ fill: 'none', strokeWidth: 1.8 }} />,
};

/**
 * Glifo de tipo de evento: la forma dice el tipo; el color sale de --type-<tipo>
 * (color en el tema nocturno, tinta en papel). `alert`: 0–3 según alerta oficial.
 */
export function Glyph({ shape, type, alert = 0, size = 14 }: { shape: Shape; type: string; alert?: number; size?: number }) {
  return (
    <svg className={`glyph alert-${Math.min(3, alert)}`} width={size} height={size} viewBox="0 0 14 14"
      style={{ '--g': `var(--type-${type})` } as CSSProperties} aria-hidden="true">
      {PATHS[shape]}
    </svg>
  );
}

/** Punto de color de un tipo (chips y leyendas del mapa nocturno). */
export function TypeDot({ type }: { type: string }) {
  return <span className="dot" style={{ '--g': `var(--type-${type})` } as CSSProperties} aria-hidden="true" />;
}
