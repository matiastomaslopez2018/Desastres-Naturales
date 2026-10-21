'use client';
/* La simulación frente a lo observado: horas de llegada y alturas en boyas DART (NOAA NCEI). */
import type { Comparison } from '@/lib/tsunami/analysis';
import { TSU_TEXT } from '@/lib/tsunami/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';

const W = 340, H = 300, L = 46, R = 12, T = 12, B = 40;
const r1 = (v: number) => Math.round(v * 10) / 10;

function Scatter({ pts, log, title, lang }: { pts: { x: number; y: number; dart: boolean }[]; log: boolean; title: string; lang: Lang }) {
  const t = TSU_TEXT[lang];
  if (!pts.length) return null;
  const vals = pts.flatMap((p) => [p.x, p.y]).filter((v) => v > 0);
  let lo = log ? 10 ** Math.floor(Math.log10(Math.min(...vals))) : 0, hi = log ? 10 ** Math.ceil(Math.log10(Math.max(...vals))) : Math.ceil(Math.max(...vals) / 5) * 5;
  if (!log && hi <= 0) hi = 1;
  if (log && lo === hi) lo = hi / 10;
  const f = (v: number) => (log ? (Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) : (v - lo) / (hi - lo));
  const X = (v: number) => r1(L + f(v) * (W - L - R)), Y = (v: number) => r1(T + (1 - f(v)) * (H - T - B));
  const ticks = log ? Array.from({ length: Math.round(Math.log10(hi / lo)) + 1 }, (_, i) => lo * 10 ** i) : Array.from({ length: 6 }, (_, i) => lo + ((hi - lo) * i) / 5);
  return (
    <figure className="ts-scatter">
      <figcaption className="qs-h3">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#e7e7e2" />
            <line x1={X(v)} x2={X(v)} y1={T} y2={H - B} stroke="#e7e7e2" />
            <text x={L - 6} y={Y(v)} textAnchor="end" dominantBaseline="middle" className="qs-axis">{fmtNum(lang, v, v < 1 ? 2 : 0)}</text>
            <text x={X(v)} y={H - B + 14} textAnchor="middle" className="qs-axis">{fmtNum(lang, v, v < 1 ? 2 : 0)}</text>
          </g>
        ))}
        <line x1={X(lo)} y1={Y(lo)} x2={X(hi)} y2={Y(hi)} stroke="#e8590c" strokeWidth={1.5} />
        {pts.map((p, i) => p.dart
          ? <path key={i} d={`M${X(p.x)},${Y(p.y) - 4.5}L${X(p.x) + 4.5},${Y(p.y)}L${X(p.x)},${Y(p.y) + 4.5}L${X(p.x) - 4.5},${Y(p.y)}Z`} fill="#141414" />
          : <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={2.6} fill="rgba(28,110,214,.6)" />)}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="qs-axis">{t.observed}</text>
        <text x={12} y={(T + H - B) / 2} textAnchor="middle" className="qs-axis" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>{t.simulated}</text>
      </svg>
    </figure>
  );
}

export function Validation({ lang, cmp }: { lang: Lang; cmp: Comparison }) {
  const t = TSU_TEXT[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const pct = (v: number) => `${v > 0 ? '+' : '−'}${nf(Math.abs(v) * 100, 1)} %`;
  const nDart = cmp.arrivals.filter((a) => a.g[4] === 3).length, nGauge = cmp.arrivals.length - nDart;
  if (cmp.arrivals.length < 3 && cmp.amps.length < 3) return <p className="qs-note">{t.noObs}</p>;
  return (
    <div className="ts-check">
      <div className="ts-check-grid">
        <Scatter lang={lang} title={t.arrivalsTitle} log={false} pts={cmp.arrivals.map((a) => ({ x: a.obs / 60, y: a.sim / 60, dart: a.g[4] === 3 }))} />
        <Scatter lang={lang} title={t.ampsTitle} log pts={cmp.amps.map((a) => ({ x: a.obs, y: a.sim, dart: true }))} />
      </div>
      <ul className="ed-list ts-stats">
        {cmp.medDart != null && nDart >= 2 && <li>{t.statDart(pct(cmp.medDart), nDart)}</li>}
        {cmp.medGauge != null && nGauge >= 2 && <li>{t.statGauge(pct(cmp.medGauge), nGauge)} {t.statWithin(`${nf(cmp.within * 100)} %`)}</li>}
        {cmp.ampRatio != null && cmp.amps.length >= 2 && <li>{t.statAmp(`×${nf(cmp.ampRatio, 2)}`, cmp.amps.length)}</li>}
      </ul>
      <p className="qs-help">{t.checkWhy}</p>
    </div>
  );
}
