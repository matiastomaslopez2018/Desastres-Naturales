import { globePaths } from '@/lib/globeSvg';
import { PAPER, SHAPE, paperStyle, shapeD } from '@/lib/symbols';
import type { DisasterEvent } from '@/lib/types';

/** Globo SVG estático (2b, papel) centrado en el evento, sin JS. */
export function StaticGlobe({ e, plates, label, size = 520 }: { e: DisasterEvent; plates?: unknown; label: string; size?: number }) {
  const g = globePaths(e.lon, e.lat, size, plates, e.track);
  const st = paperStyle(e);
  const sh = SHAPE[e.type];
  const r = 9;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path d={g.sphere} fill={PAPER.sphere} />
      <path d={g.grat} fill="none" stroke={PAPER.grat} strokeWidth={0.6} />
      <path d={g.land} fill={PAPER.land} />
      <path d={g.borders} fill="none" stroke={PAPER.borders} strokeWidth={0.7} />
      {g.plates && <path d={g.plates} fill="none" stroke={PAPER.plates} strokeWidth={0.8} strokeDasharray="3 3" />}
      <path d={g.sphere} fill="none" stroke={PAPER.ink} strokeOpacity={0.6} />
      {g.track && <path d={g.track} fill="none" stroke={PAPER.ink} strokeOpacity={0.6} />}
      <path d={shapeD(sh, g.x, g.y, r)} fill={sh === 'cross' ? 'none' : st.fill === 'none' ? PAPER.sphere : st.fill}
        fillOpacity={st.fill === 'none' ? 1 : st.fillOpacity} stroke={st.stroke} strokeWidth={sh === 'cross' ? 1.8 : 1.4} />
      <circle cx={g.x} cy={g.y} r={r + 10} fill="none" stroke={PAPER.ink} strokeWidth={1} />
      <path d={`M${g.x + r + 10} ${g.y}H${g.x + r + 34}`} stroke={PAPER.ink} />
    </svg>
  );
}
