'use client';
/*
 * Cómo nace el tsunami: el deslizamiento de la falla (subfallas del modelo del USGS), el movimiento vertical
 * del fondo (Okada) y un corte perpendicular a la fosa por el punto de mayor levantamiento.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { FaultRow } from '@/lib/tsunami/source';
import { boxLon, type OceanBox } from '@/lib/tsunami/presets';
import { TSU_TEXT } from '@/lib/tsunami/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import type { FineSource } from './tsunami.worker';

const D2R = Math.PI / 180, KM_DEG = 111.19;

/** Color de deslizamiento (amarillo → rojo oscuro). */
const slipColor = (f: number) => `rgb(${Math.round(255 - 70 * f)},${Math.round(230 - 200 * f)},${Math.round(120 - 100 * f)})`;

/** Batimetría global (para dibujar la tierra con 25 km de detalle). */
type Global = { z: Int16Array; nx: number; ny: number; lon0: number; lat0: number; step: number };
type Props = { lang: Lang; faults: FaultRow[]; slipScale: number; fine: FineSource; global: Global; box: OceanBox; uniform: boolean };

export function SourcePanel({ lang, faults, slipScale, fine, global, box, uniform }: Props) {
  const t = TSU_TEXT[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const wrapLon = (lon: number) => boxLon(box, lon);
  const lonMax = fine.lon0 + (fine.nx - 1) * fine.step, latMax = fine.lat0 + (fine.ny - 1) * fine.step;
  const midLat = (fine.lat0 + latMax) / 2, kx = Math.cos(midLat * D2R);
  const W = 360, H = Math.round(Math.min(380, (W * (latMax - fine.lat0)) / ((lonMax - fine.lon0) * kx)));
  const X = (lon: number) => ((wrapLon(lon) - fine.lon0) / (lonMax - fine.lon0)) * W, Y = (lat: number) => (1 - (lat - fine.lat0) / (latMax - fine.lat0)) * H;
  const maxSlip = Math.max(...faults.map((r) => r[8] * slipScale), 0.01);

  // Rumbo medio (ponderado por deslizamiento) y punto de mayor levantamiento.
  const geo = useMemo(() => {
    let sx = 0, sy = 0;
    for (const r of faults) { sx += r[8] * Math.sin(r[5] * D2R); sy += r[8] * Math.cos(r[5] * D2R); }
    const strike = Math.atan2(sx, sy) / D2R;
    let best = 0, bi = 0;
    fine.dz.forEach((v, k) => { if (v > best) { best = v; bi = k; } });
    const lon = fine.lon0 + (bi % fine.nx) * fine.step, lat = fine.lat0 + Math.floor(bi / fine.nx) * fine.step;
    let low = 0;
    fine.dz.forEach((v) => { low = Math.min(low, v); });
    return { strike, lon, lat, up: best, down: low };
  }, [faults, fine]);

  /** Muestra bilineal de la deformación fina. */
  const dzAt = (lon: number, lat: number) => {
    const fi = (wrapLon(lon) - fine.lon0) / fine.step, fj = (lat - fine.lat0) / fine.step;
    if (fi < 0 || fj < 0 || fi > fine.nx - 1 || fj > fine.ny - 1) return NaN;
    const i = Math.min(fine.nx - 2, Math.floor(fi)), j = Math.min(fine.ny - 2, Math.floor(fj)), u = fi - i, v = fj - j, n = fine.nx;
    const g = (a: number, b: number) => fine.dz[b * n + a];
    return (1 - u) * (1 - v) * g(i, j) + u * (1 - v) * g(i + 1, j) + (1 - u) * v * g(i, j + 1) + u * v * g(i + 1, j + 1);
  };
  const isLand = (lon: number, lat: number) => {
    const x = ((lon % 360) + 360) % 360, i = Math.round((x - global.lon0) / global.step) % global.nx, j = Math.round((lat - global.lat0) / global.step);
    return j >= 0 && j < global.ny && global.z[j * global.nx + i] > 0;
  };

  // Corte: de −250 a +250 km sobre la dirección del buzamiento (+: hacia la costa).
  const prof = useMemo(() => {
    const az = (geo.strike + 90) * D2R, pts: { d: number; dz: number; land: boolean }[] = [];
    for (let d = -250; d <= 250; d += 5) {
      const lat = geo.lat + (d * Math.cos(az)) / KM_DEG, lon = geo.lon + (d * Math.sin(az)) / (KM_DEG * Math.cos(geo.lat * D2R));
      pts.push({ d, dz: dzAt(lon, lat), land: isLand(lon, lat) });
    }
    return pts.filter((p) => Number.isFinite(p.dz));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, fine, global]);

  const dzCv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = dzCv.current;
    if (!c) return;
    c.width = fine.nx; c.height = fine.ny;
    const ctx = c.getContext('2d')!, img = ctx.createImageData(fine.nx, fine.ny), d = img.data;
    const scale = Math.max(geo.up, -geo.down, 0.1);
    for (let j = 0; j < fine.ny; j++) for (let i = 0; i < fine.nx; i++) {
      const v = fine.dz[j * fine.nx + i], p = ((fine.ny - 1 - j) * fine.nx + i) * 4, m = Math.min(1, Math.sqrt(Math.abs(v) / scale));
      const lon = fine.lon0 + i * fine.step, lat = fine.lat0 + j * fine.step;
      const land = isLand(lon, lat);
      const base = land ? [226, 220, 204] : [214, 230, 238];
      const col = v > 0 ? [214, 40, 57] : [28, 110, 214];
      for (let q = 0; q < 3; q++) d[p + q] = base[q] * (1 - m) + col[q] * m;
      d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fine, geo, global]);

  // Rectángulos de las subfallas proyectados en superficie.
  const quads = faults.map((r) => {
    const [lon, lat, , L, Wd, strike, dip] = r, s = strike * D2R, half = (Wd * Math.cos(dip * D2R)) / 2;
    const along = [Math.sin(s), Math.cos(s)], across = [Math.cos(s), -Math.sin(s)];
    const pt = (a: number, b: number) => {
      const ex = along[0] * a + across[0] * b, ny = along[1] * a + across[1] * b;
      return [X(lon + ex / (KM_DEG * Math.cos(lat * D2R))), Y(lat + ny / KM_DEG)];
    };
    return { slip: r[8] * slipScale, pts: [pt(-L / 2, -half), pt(L / 2, -half), pt(L / 2, half), pt(-L / 2, half)] };
  });

  // Gráfico del corte.
  const PW = 900, PH = 260, PL = 56, PR = 12, PT = 14, PB = 34;
  const yMax = Math.max(geo.up, 0.5) * 1.15, yMin = Math.min(geo.down, -0.3) * 1.15;
  const px = (d: number) => PL + ((d + 250) / 500) * (PW - PL - PR), py = (v: number) => PT + ((yMax - v) / (yMax - yMin)) * (PH - PT - PB);
  const line = prof.map((p, i) => `${i ? 'L' : 'M'}${px(p.d).toFixed(1)},${py(p.dz).toFixed(1)}`).join('');
  const area = prof.length ? `M${px(prof[0].d).toFixed(1)},${py(0).toFixed(1)}${prof.map((p) => `L${px(p.d).toFixed(1)},${py(p.dz).toFixed(1)}`).join('')}L${px(prof[prof.length - 1].d).toFixed(1)},${py(0).toFixed(1)}Z` : '';

  return (
    <div className="ts-source">
      <div className="ts-source-maps">
        <figure>
          <svg viewBox={`0 0 ${W} ${H}`} className="ts-fig" role="img" aria-label={t.slipM}>
            <rect width={W} height={H} fill="#eef3f5" />
            {quads.map((q, i) => <path key={i} d={`M${q.pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L')}Z`} fill={slipColor(q.slip / maxSlip)} stroke="rgba(0,0,0,.25)" strokeWidth={0.5} />)}
          </svg>
          <figcaption>{t.slipM}: 0 – {nf(maxSlip, maxSlip < 10 ? 1 : 0)} m</figcaption>
        </figure>
        <figure>
          <div className="ts-fig" style={{ aspectRatio: `${W} / ${H}` }}>
            <canvas ref={dzCv} style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'auto' }} aria-hidden="true" />
          </div>
          <figcaption><span style={{ color: '#d62839' }}>■</span> {t.uplift} {nf(geo.up, 1)} m · <span style={{ color: '#1c6ed6' }}>■</span> {t.subsidence} {nf(-geo.down, 1)} m</figcaption>
        </figure>
      </div>
      <figure>
        <svg viewBox={`0 0 ${PW} ${PH}`} className="ts-fig" role="img" aria-label={t.profile}>
          <line x1={PL} x2={PW - PR} y1={py(0)} y2={py(0)} stroke="#5a8fb0" strokeDasharray="4 3" />
          <path d={area} fill="rgba(214,40,57,.18)" />
          <path d={line} fill="none" stroke="#141414" strokeWidth={1.8} />
          {prof.filter((p) => p.land).map((p) => <rect key={p.d} x={px(p.d) - 3} y={PH - PB - 4} width={6} height={4} fill="#b09a73" />)}
          {[yMin, 0, yMax].map((v) => <text key={v} x={PL - 6} y={py(v)} textAnchor="end" dominantBaseline="middle" className="qs-axis">{nf(v, 1)} m</text>)}
          {[-200, -100, 0, 100, 200].map((d) => <text key={d} x={px(d)} y={PH - PB + 14} textAnchor="middle" className="qs-axis">{nf(d)}</text>)}
          <text x={PL} y={PH - 4} className="qs-axis">← {t.seaward}</text>
          <text x={PW - PR} y={PH - 4} textAnchor="end" className="qs-axis">{t.landward} → (km)</text>
        </svg>
        <figcaption>{t.profile}. {t.profileNote}</figcaption>
      </figure>
      {uniform && <p className="qs-help">{t.sourceUniform}</p>}
    </div>
  );
}
