'use client';
/* Corte de la Tierra a escala con los frentes de onda P y S (campo de tiempos de la marcha rápida). */
import { useEffect, useMemo, useRef } from 'react';
import { CONRAD, MOHO, flatZ, rayPath, travelTimeField, type Arrival } from '@/lib/quake/waves';
import type { Rupture } from '@/lib/quake/source';
import { SIM_TEXT } from '@/lib/quake/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { niceStep, prep, useCanvasSize, type Clock } from './clock';

export const P_RGB = [232, 89, 12] as const, S_RGB = [12, 133, 153] as const;
const rgb = (c: readonly number[], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const SKY = 46; // franja sobre la superficie para el lugar y el reloj

type Props = {
  lang: Lang; clock: Clock;
  depth: number; dist: number; rup: Rupture;
  tP: Arrival; tS: Arrival;
  /** Si se dibujan las ondas superficiales (sismos poco profundos). */
  surface: boolean;
  siteLabel: string;
};

/** Ventana del corte: incluye fuente, ruptura y lugar, con la misma escala en horizontal y en vertical. */
function view(w: number, h: number, depth: number, dist: number, rup: Rupture) {
  const xs = [0, dist, rup.top[0], rup.bottom[0]];
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  const pad = Math.max((x1 - x0) * 0.12, 8);
  x0 -= pad; x1 += pad;
  const zNeed = Math.max(Math.max(depth, rup.bottom[1]) * 1.3, 45);
  const k = Math.max((x1 - x0) / w, zNeed / h); // km por píxel
  const extra = k * w - (x1 - x0);
  x0 -= extra / 2; x1 += extra / 2;
  return { x0, x1, zMax: Math.min(k * h, 780), k };
}

export function Section({ lang, clock, depth, dist, rup, tP, tS, surface, siteLabel }: Props) {
  const t = SIM_TEXT[lang];
  const { now, subscribe } = clock;
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);
  const eh = Math.max(1, h - SKY);
  const V = useMemo(() => (w ? view(w, eh, depth, dist, rup) : null), [w, eh, depth, dist, rup]);

  // Campos de tiempos, rayos y mapeo de cada celda de pantalla (media resolución) a la grilla.
  const geo = useMemo(() => {
    if (!V) return null;
    const FP = travelTimeField('P', depth, V.x0, V.x1, V.zMax, 300), FS = travelTimeField('S', depth, V.x0, V.x1, V.zMax, 300);
    const cw = Math.ceil(w / 2), ch = Math.ceil(eh / 2);
    const idx = new Int32Array(cw * ch), fu = new Float32Array(cw * ch), fv = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      const z = (y * 2 + 1) * V.k, fj = flatZ(z) / FP.dx;
      const j = Math.min(FP.nz - 2, Math.floor(fj)), v = Math.min(1, fj - j);
      for (let x = 0; x < cw; x++) {
        const fi = (V.x0 + (x * 2 + 1) * V.k - FP.x0) / FP.dx;
        const i = Math.max(0, Math.min(FP.nx - 2, Math.floor(fi)));
        const c = y * cw + x;
        idx[c] = j * FP.nx + i; fu[c] = Math.max(0, Math.min(1, fi - i)); fv[c] = v;
      }
    }
    return { FP, FS, cw, ch, idx, fu, fv, rayP: rayPath(FP, dist, depth), rayS: rayPath(FS, dist, depth) };
  }, [V, w, eh, depth, dist]);

  // Fondo fijo: capas, discontinuidades, ejes y rótulos.
  const base = useMemo(() => {
    if (!V || typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    const ctx = prep(c, w, h, dpr);
    if (!ctx) return null;
    const Y = (z: number) => SKY + z / V.k;
    ctx.fillStyle = '#fafaf8'; ctx.fillRect(0, 0, w, SKY);
    const band = (z0: number, z1: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(0, Y(z0), w, Y(Math.min(z1, V.zMax)) - Y(z0) + 1); };
    band(0, CONRAD, '#efe6d3'); band(CONRAD, MOHO, '#e7dbc3');
    const g = ctx.createLinearGradient(0, Y(MOHO), 0, Y(V.zMax));
    g.addColorStop(0, '#dfcdb0'); g.addColorStop(1, '#d2b893');
    ctx.fillStyle = g; ctx.fillRect(0, Y(MOHO), w, h - Y(MOHO));
    ctx.font = '12px var(--font-isans), system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const line = (z: number, dash: number[], label: string) => {
      if (z > V.zMax) return;
      ctx.strokeStyle = 'rgba(60,45,25,.45)'; ctx.lineWidth = 1; ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(0, Y(z)); ctx.lineTo(w, Y(z)); ctx.stroke(); ctx.setLineDash([]);
      if (label) { ctx.fillStyle = 'rgba(60,45,25,.75)'; ctx.fillText(label, 8, Y(z) - 8); }
    };
    line(CONRAD, [2, 4], '');
    line(MOHO, [7, 5], `${t.moho} · ${fmtNum(lang, MOHO)} km`);
    for (const z of [210, 410, 660]) line(z, [2, 6], `${fmtNum(lang, z)} km`);
    // Rótulos de las capas con su velocidad P (si hay lugar).
    ctx.fillStyle = 'rgba(60,45,25,.8)';
    const lab = (z0: number, z1: number, txt: string) => { if (Y(Math.min(z1, V.zMax)) - Y(z0) > 22) ctx.fillText(txt, 8, (Y(z0) + Y(Math.min(z1, V.zMax))) / 2); };
    lab(0, CONRAD, `${t.upperCrust} · P ${fmtNum(lang, 5.8, 1)} km/s`);
    lab(CONRAD, MOHO, `${t.lowerCrust} · P ${fmtNum(lang, 6.5, 1)} km/s`);
    // El manto se rotula justo debajo del Moho (abajo a la izquierda va la escala).
    if (h - Y(MOHO) > 40) ctx.fillText(`${t.mantle} · P ${fmtNum(lang, 8.0, 1)}+ km/s`, 8, Y(MOHO) + 14);
    // Superficie.
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, SKY); ctx.lineTo(w, SKY); ctx.stroke();
    // Eje de profundidad a la derecha.
    const step = niceStep(V.zMax, 5);
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(60,45,25,.7)'; ctx.font = '11px var(--font-isans), system-ui, sans-serif';
    for (let z = step; z < V.zMax - step * 0.3; z += step) { ctx.fillText(`${fmtNum(lang, z)} km`, w - 6, Y(z)); ctx.fillRect(w - 3, Y(z), 3, 1); }
    // Escala horizontal.
    const sb = niceStep(V.x1 - V.x0, 6), px = sb / V.k;
    ctx.fillStyle = '#141414'; ctx.fillRect(12, h - 14, px, 2);
    ctx.textAlign = 'center'; ctx.fillText(`${fmtNum(lang, sb)} km`, 12 + px / 2, h - 24);
    ctx.textAlign = 'left';
    return c;
  }, [V, w, h, dpr, lang, t]);

  useEffect(() => {
    const canvas = cv.current;
    if (!V || !geo || !base || !canvas) return;
    const off = document.createElement('canvas');
    off.width = geo.cw; off.height = geo.ch;
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(geo.cw, geo.ch);
    const X = (x: number) => (x - V.x0) / V.k, Y = (z: number) => SKY + z / V.k;
    // Ancho del frente: lo que la onda avanza en ~2,5 píxeles.
    const bandP = (2.5 * V.k) / 6.5, bandS = (2.5 * V.k) / 3.8;
    const sampleT = (F: typeof geo.FP, c: number) => {
      const i = geo.idx[c], u = geo.fu[c], v = geo.fv[c], T = F.t, nx = F.nx;
      return (1 - u) * (1 - v) * T[i] + u * (1 - v) * T[i + 1] + (1 - u) * v * T[i + nx] + u * v * T[i + nx + 1];
    };

    const draw = (time: number) => {
      const ctx = prep(canvas, w, h, dpr);
      if (!ctx) return;
      ctx.drawImage(base, 0, 0, w, h);
      // Frentes y estela de cada onda.
      const d = img.data;
      for (let c = 0; c < geo.cw * geo.ch; c++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (const [F, col, band, amp] of [[geo.FS, S_RGB, bandS, 0.3], [geo.FP, P_RGB, bandP, 0.2]] as const) {
          const dt = time - sampleT(F, c);
          if (dt < 0 || !Number.isFinite(dt)) continue;
          const al = dt < band ? 0.95 : amp * Math.exp(-(dt - band) / (band * 10));
          r = col[0] * al + r * (1 - al); g = col[1] * al + g * (1 - al); b = col[2] * al + b * (1 - al); a = al + a * (1 - al);
        }
        const k = c * 4;
        d[k] = a ? r / a : 0; d[k + 1] = a ? g / a : 0; d[k + 2] = a ? b / a : 0; d[k + 3] = a * 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, SKY, geo.cw * 2, geo.ch * 2);

      // Rayos de primera llegada (punteados; se marcan al llegar).
      const ray = (pts: [number, number][], col: readonly number[], arrived: boolean) => {
        ctx.strokeStyle = rgb(col, arrived ? 0.95 : 0.4); ctx.lineWidth = arrived ? 2 : 1.25; ctx.setLineDash([4, 4]);
        ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z)))); ctx.stroke(); ctx.setLineDash([]);
      };
      ray(geo.rayS, S_RGB, time >= tS.t);
      ray(geo.rayP, P_RGB, time >= tP.t);

      // Ondas superficiales: ondulación sobre la superficie que avanza a 3,5 (Love) y 3,0 km/s (Rayleigh).
      if (surface && time > 0) for (const [v, lab] of [[3.5, 'L'], [3.0, 'R']] as const) {
        for (const dir of [1, -1]) {
          const xf = dir * v * time, px = X(xf);
          if (px < -40 || px > w + 40) continue;
          ctx.strokeStyle = 'rgba(112,72,232,.85)'; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let k = 0; k <= 30; k++) { const q = px - dir * k * 1.6; const yy = SKY - Math.sin(k * 0.7) * 3 * Math.exp(-k / 14); if (k) ctx.lineTo(q, yy); else ctx.moveTo(q, yy); }
          ctx.stroke();
          if (dir === 1 && px > 10 && px < w - 10) { ctx.fillStyle = 'rgb(112,72,232)'; ctx.font = '600 11px var(--font-isans), system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lab, px, SKY + 12); }
        }
      }

      // Ruptura (vista de canto) y focos.
      ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X(rup.top[0]), Y(rup.top[1])); ctx.lineTo(X(rup.bottom[0]), Y(rup.bottom[1])); ctx.stroke();
      ctx.lineCap = 'butt';
      const star = (x: number, y: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
        ctx.closePath(); ctx.fillStyle = '#c8102e'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      };
      star(X(0), Y(depth), 9);
      ctx.font = '600 12px var(--font-isans), system-ui, sans-serif'; ctx.fillStyle = '#141414'; ctx.textBaseline = 'middle';
      const hypoRight = X(0) + 14 + 90 < w;
      ctx.textAlign = hypoRight ? 'left' : 'right';
      ctx.fillText(t.hypocenter, X(0) + (hypoRight ? 14 : -14), Y(depth));
      // Epicentro: marca en la superficie.
      ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.moveTo(X(0), SKY); ctx.lineTo(X(0) - 6, SKY - 10); ctx.lineTo(X(0) + 6, SKY - 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#141414'; ctx.textAlign = 'center'; ctx.font = '12px var(--font-isans), system-ui, sans-serif';
      if (Math.abs(X(dist) - X(0)) > 70) ctx.fillText(t.epicenter, X(0), SKY - 20);

      // El lugar: casitas sobre la superficie y pulsos al llegar cada onda.
      const sx = X(dist);
      for (const [ta, col] of [[tP.t, P_RGB], [tS.t, S_RGB]] as const) {
        const since = time - ta;
        if (since >= 0 && since < 2.5) { ctx.strokeStyle = rgb(col, 1 - since / 2.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, SKY, 6 + since * 14, Math.PI, 2 * Math.PI); ctx.stroke(); }
      }
      const shake = time >= tS.t ? Math.sin(time * 40) * Math.min(2, 2 * Math.exp(-(time - tS.t) / 6)) : 0;
      ctx.fillStyle = '#141414';
      ctx.fillRect(sx - 11 + shake, SKY - 18, 8, 18); ctx.fillRect(sx - 1 + shake, SKY - 26, 10, 26); ctx.fillRect(sx + 11 + shake, SKY - 13, 6, 13);
      ctx.textAlign = sx > w - 80 ? 'right' : 'center';
      ctx.font = '600 12px var(--font-isans), system-ui, sans-serif';
      ctx.fillText(siteLabel, sx > w - 80 ? sx + 18 : sx, SKY - 36);

      // Reloj.
      ctx.textAlign = 'left'; ctx.font = '600 14px var(--font-isans), system-ui, sans-serif'; ctx.fillStyle = '#141414';
      ctx.fillText(`t = ${fmtNum(lang, time, 1)} s`, 10, 16);
    };
    draw(now());
    return subscribe(draw);
  }, [V, geo, base, w, h, dpr, now, subscribe, depth, dist, rup, tP, tS, surface, siteLabel, lang, t]);

  return (
    <div ref={wrap} className="qs-section">
      <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} role="img"
        aria-label={`${t.section}: ${t.hypocenter} ${fmtNum(lang, depth)} km, ${t.you} ${fmtNum(lang, dist)} km. ${t.waveP} ${t.arrives} ${fmtNum(lang, tP.t, 1)} s, ${t.waveS} ${t.arrives} ${fmtNum(lang, tS.t, 1)} s.`} />
    </div>
  );
}
