/*
 * Esquema animado de cómo se mueven los bloques en cada tipo de falla (solo ilustrativo).
 * Inversa y normal: corte vertical con el plano de falla inclinado; de rumbo: vista en planta.
 * La animación respeta prefers-reduced-motion (ver paper.css).
 */
import type { FaultKind } from '@/lib/server/geology';

export function FaultDiagram({ kind, label }: { kind: FaultKind; label: string }) {
  if (kind === 'strike-slip') {
    return (
      <svg className="fault fault-ss" viewBox="0 0 220 120" role="img" aria-label={label}>
        <g className="fault-a"><rect x="10" y="10" width="200" height="48" className="blk" /><path d="M40 34h40M150 34h40" className="road" /></g>
        <g className="fault-b"><rect x="10" y="62" width="200" height="48" className="blk blk2" /><path d="M40 86h40M150 86h40" className="road" /></g>
        <path d="M10 60h200" className="plane" />
        <path d="M120 22l20 0m-6-5l6 5-6 5" className="arrow" /><path d="M100 98l-20 0m6-5l-6 5 6 5" className="arrow" />
      </svg>
    );
  }
  const up = kind === 'reverse' || kind === 'oblique';
  return (
    <svg className={`fault ${up ? 'fault-rev' : 'fault-nor'}`} viewBox="0 0 220 120" role="img" aria-label={label}>
      {/* Bloque de piso (izquierda) y de techo (derecha), separados por un plano inclinado. */}
      <path d="M10 40 L95 40 L135 110 L10 110 Z" className="blk" />
      <g className="fault-hw"><path d="M95 40 L210 40 L210 110 L135 110 Z" className="blk blk2" /></g>
      <path d="M95 40 L135 110" className="plane" />
      {up
        ? <><path d="M40 25h28m-6-5l6 5-6 5" className="arrow" /><path d="M185 25h-28m6-5l-6 5 6 5" className="arrow" /></>
        : <><path d="M68 25h-28m6-5l-6 5 6 5" className="arrow" /><path d="M157 25h28m-6-5l6 5-6 5" className="arrow" /></>}
    </svg>
  );
}
