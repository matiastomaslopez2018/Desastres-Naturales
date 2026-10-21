'use client';
/*
 * Mapa del océano (proyección equirectangular de la cuenca simulada): batimetría y relieve, el nivel del mar
 * en cada instante (interpolado entre cuadros), las isócronas de llegada cada una hora y los mareógrafos y
 * boyas reales, que se llenan cuando llegó la ola según lo observado.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { Grid } from '@/lib/tsunami/swe';
import { boxLon, type OceanBox } from '@/lib/tsunami/presets';
import type { Gauge } from '@/lib/tsunami/analysis';
import { TSU_TEXT } from '@/lib/tsunami/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { prep, useCanvasSize, type Clock } from '../quake/clock';

type Props = {
  lang: Lang; clock: Clock; grid: Grid; wet: Uint8Array; box: OceanBox;
  frames: Int8Array[] | null; frameS: number; amp: number; arrival: Float32Array | null;
  gauges: Gauge[]; sites: { name: string; lon: number; lat: number }[]; epi: [number, number];
};

const UP = [214, 40, 57], DOWN = [28, 110, 214];

export function OceanMap({ lang, clock, grid, wet, box, frames, frameS, amp, arrival, gauges, sites, epi }: Props) {
  const t = TSU_TEXT[lang];
  const { now, subscribe } = clock;
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);
  const { nx, ny } = grid;

  // Fondo: profundidad del mar y relieve sombreado (a la resolución de la grilla), más las isócronas.
  const base = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = nx; c.height = ny;
    const ctx = c.getContext('2d')!, img = ctx.createImageData(nx, ny), d = img.data;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, p = ((ny - 1 - j) * nx + i) * 4, hh = grid.h[k];
      let r: number, g: number, b: number;
      if (wet[k]) {
        const f = Math.min(1, Math.sqrt(hh / 7000));
        r = 196 - 150 * f; g = 223 - 140 * f; b = 236 - 105 * f;
      } else {
        const elev = -hh, west = i > 0 ? -grid.h[k - 1] : elev, north = j < ny - 1 ? -grid.h[k + nx] : elev;
        const shadeV = Math.max(-1, Math.min(1, ((elev - west) + (north - elev)) / 900));
        const f = Math.min(1, Math.max(0, elev) / 3500);
        r = 226 - 60 * f + 26 * shadeV; g = 220 - 70 * f + 26 * shadeV; b = 204 - 80 * f + 26 * shadeV;
      }
      // Isócronas: borde entre celdas con distinta hora entera de llegada.
      if (arrival && wet[k] && arrival[k] > 0) {
        const hr = Math.floor(arrival[k] / 3600);
        const e = i < nx - 1 && wet[k + 1] && arrival[k + 1] > 0 ? Math.floor(arrival[k + 1] / 3600) : hr;
        const n = j < ny - 1 && wet[k + nx] && arrival[k + nx] > 0 ? Math.floor(arrival[k + nx] / 3600) : hr;
        if (e !== hr || n !== hr) { r *= 0.55; g *= 0.55; b *= 0.6; }
      }
      d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }, [grid, wet, nx, ny, arrival]);

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas || !w || !base) return;
    const off = document.createElement('canvas'); off.width = nx; off.height = ny;
    const octx = off.getContext('2d')!, img = octx.createImageData(nx, ny), d = img.data;
    const sx = w / nx, sy = h / ny;
    const X = (lon: number) => (boxLon(box, lon) - grid.lon0 + grid.step / 2) / grid.step * sx;
    const Y = (lat: number) => (ny - (lat - grid.lat0 + grid.step / 2) / grid.step) * sy;
    const draw = (time: number) => {
      const ctx = prep(canvas, w, h, dpr);
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(base, 0, 0, w, h);
      if (frames && frames.length) {
        const fi = Math.min(frames.length - 1, time / frameS), a = Math.floor(fi), b = Math.min(frames.length - 1, a + 1), u = fi - a;
        const A = frames[a], B = frames[b];
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const k = j * nx + i, p = ((ny - 1 - j) * nx + i) * 4;
          const q = A[k] * (1 - u) + B[k] * u, m = Math.abs(q) / 127;
          if (m < 0.02) { d[p + 3] = 0; continue; }
          const col = q > 0 ? UP : DOWN;
          d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = Math.min(235, 40 + 230 * m);
        }
        octx.putImageData(img, 0, 0);
        ctx.drawImage(off, 0, 0, w, h);
      }
      // Mareógrafos y boyas DART: se llenan cuando pasó la hora de llegada observada.
      for (const g of gauges) {
        const x = X(g[0]), y = Y(g[1]);
        if (x < 0 || x > w || y < 0 || y > h) continue;
        const arrived = g[2] > 0 && time >= g[2] * 60;
        ctx.beginPath();
        if (g[4] === 3) { ctx.moveTo(x, y - 4.5); ctx.lineTo(x + 4.5, y); ctx.lineTo(x, y + 4.5); ctx.lineTo(x - 4.5, y); ctx.closePath(); }
        else ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = arrived ? '#141414' : 'rgba(255,255,255,.85)'; ctx.fill();
        ctx.strokeStyle = '#141414'; ctx.lineWidth = 1; ctx.stroke();
      }
      // Epicentro y lugares de la costa.
      const ex = X(epi[0]), ey = Y(epi[1]);
      ctx.fillStyle = '#c8102e'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 3.5 : 8; ctx.lineTo(ex + rr * Math.cos(an), ey + rr * Math.sin(an)); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.font = '600 12px var(--font-isans), system-ui, sans-serif'; ctx.textBaseline = 'middle';
      for (const s of sites) {
        const x = X(s.lon), y = Y(s.lat);
        ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.textAlign = x > w - 90 ? 'right' : 'left';
        const tx = x + (x > w - 90 ? -8 : 8);
        ctx.strokeText(s.name, tx, y); ctx.fillText(s.name, tx, y);
      }
      // Reloj.
      const hh = Math.floor(time / 3600), mm = Math.floor((time % 3600) / 60);
      const label = t.hoursAfter(`${hh} ${t.h} ${String(mm).padStart(2, '0')} ${t.min}`);
      ctx.font = '600 14px var(--font-isans), system-ui, sans-serif'; ctx.textAlign = 'left';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(8, 8, tw + 16, 26);
      ctx.fillStyle = '#141414'; ctx.fillText(label, 16, 21);
    };
    draw(now());
    return subscribe(draw);
  }, [w, h, dpr, now, subscribe, base, frames, frameS, gauges, sites, epi, grid, box, nx, ny, t]);

  return (
    <div ref={wrap} className="ts-map" style={{ aspectRatio: `${nx} / ${ny}` }}>
      <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} role="img"
        aria-label={`${t.ocean}. ${fmtNum(lang, gauges.length)} ${t.gauge}/${t.dart}. ${amp} m`} />
    </div>
  );
}
