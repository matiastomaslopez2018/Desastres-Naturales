import { globePaths } from '@/lib/globeSvg';
import { COL, SHAPE, fillFor, shapeD } from '@/lib/symbols';
import type { DisasterEvent } from '@/lib/types';

/** Globo SVG estático centrado en el evento (sin JS). */
export function StaticGlobe({ e, plates, label, size = 520 }: { e: DisasterEvent; plates?: unknown; label: string; size?: number }) {
  const g = globePaths(e.lon, e.lat, size, plates, e.track);
  const st = fillFor(e);
  const sh = SHAPE[e.type];
  const r = 9;
  const s = r + 12;
  const mark = (a: number, b: number) => `M${a - 6} ${b}h12M${a} ${b - 6}v12`;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path d={g.sphere} fill={COL.bg} />
      <path d={g.grat} fill="none" stroke={COL.n200} strokeWidth={0.6} />
      <path d={g.land} fill={COL.n200} />
      <path d={g.borders} fill="none" stroke={COL.n400} strokeWidth={0.5} />
      {g.plates && <path d={g.plates} fill="none" stroke={COL.a700} strokeWidth={0.8} strokeDasharray="4 3" />}
      <path d={g.sphere} fill="none" stroke={COL.text} strokeOpacity={0.55} />
      {g.track && <path d={g.track} fill="none" stroke={COL.a700} strokeOpacity={0.6} />}
      <path d={shapeD(sh, g.x, g.y, r)} fill={sh === 'cross' ? 'none' : st.fill} stroke={st.stroke} strokeWidth={sh === 'cross' ? 1.6 : 1} />
      {st.ring && <circle cx={g.x} cy={g.y} r={r + 4} fill="none" stroke={COL.a900} />}
      <rect x={g.x - s} y={g.y - s} width={s * 2} height={s * 2} fill="none" stroke={COL.text} strokeOpacity={0.35} />
      <path d={[mark(g.x - s, g.y - s), mark(g.x + s, g.y - s), mark(g.x - s, g.y + s), mark(g.x + s, g.y + s)].join('')} stroke={COL.text} />
    </svg>
  );
}
