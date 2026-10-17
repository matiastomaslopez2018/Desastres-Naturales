import type { Section } from '@/lib/server/geology';
import { GEO } from '@/lib/geoText';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';

/** Perfil profundidad–distancia: losa (Slab2), el sismo y sus réplicas. SVG de servidor. */
export function CrossSection({ lang, s }: { lang: Lang; s: Section }) {
  const g = GEO[lang];
  const W = 640, H = 300, L = 48, R = 12, T = 14, B = 34;
  const x0 = -250, x1 = 350;
  const maxDepth = Math.max(100, ...s.slab.map((p) => p[1]), s.quake[1], ...s.aftershocks.map((a) => a[1])) * 1.1;
  const yMax = Math.ceil(maxDepth / 50) * 50;
  const X = (d: number) => L + ((d - x0) / (x1 - x0)) * (W - L - R);
  const Y = (z: number) => T + (z / yMax) * (H - T - B);
  const slabPath = s.slab.map(([d, z], i) => `${i ? 'L' : 'M'}${X(d).toFixed(1)} ${Y(z).toFixed(1)}`).join(' ');
  const ticksX = [-200, -100, 0, 100, 200, 300];
  const ticksY = Array.from({ length: yMax / 50 + 1 }, (_, i) => i * 50);
  return (
    <figure className="xsec">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${g.section}: ${g.sectionLegend.slab}, ${g.sectionLegend.quake}`}>
        <rect x={L} y={T} width={W - L - R} height={H - T - B} className="xsec-bg" />
        {ticksY.map((z) => <g key={z}><line x1={L} x2={W - R} y1={Y(z)} y2={Y(z)} className="xsec-grid" /><text x={L - 6} y={Y(z) + 4} className="xsec-tick" textAnchor="end">{z}</text></g>)}
        {ticksX.map((d) => <g key={d}><line x1={X(d)} x2={X(d)} y1={T} y2={H - B} className="xsec-grid" /><text x={X(d)} y={H - B + 15} className="xsec-tick" textAnchor="middle">{d}</text></g>)}
        <text x={(L + W - R) / 2} y={H - 4} className="xsec-axis" textAnchor="middle">{g.sectionAxis.dist}</text>
        <text x={12} y={(T + H - B) / 2} className="xsec-axis" textAnchor="middle" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>{g.sectionAxis.depth}</text>
        <path d={slabPath} className="xsec-slab" />
        {s.aftershocks.map(([d, z, m], i) => <circle key={i} cx={X(d)} cy={Y(z)} r={Math.max(1.5, (m - 2) * 1.3)} className="xsec-aft" />)}
        <path d={`M${X(0)} ${Y(s.quake[1]) - 9}l2.6 5.4 6 .9-4.3 4.2 1 5.9-5.3-2.8-5.3 2.8 1-5.9-4.3-4.2 6-.9z`} className="xsec-main" />
      </svg>
      <figcaption className="ed-note">
        <span className="xsec-key slab" /> {g.sectionLegend.slab} · <span className="xsec-key main" /> {g.sectionLegend.quake} ({fmtNum(lang, s.quake[1])} km) · <span className="xsec-key aft" /> {g.sectionLegend.aft(fmtNum(lang, s.aftershocks.length))}
        <br />{g.sectionNote(String(s.azimuth))}
      </figcaption>
    </figure>
  );
}
