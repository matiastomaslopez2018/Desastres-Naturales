'use client';
/* Tres edificios (2, 10 y 30 pisos) que oscilan con la respuesta calculada para su período, y el espectro. */
import { useEffect, useMemo, useRef } from 'react';
import type { Synth } from '@/lib/quake/synth';
import type { Motion } from '@/lib/quake/gmpe';
import { SIM_TEXT } from '@/lib/quake/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { prep, useCanvasSize, type Clock } from './clock';

/** Pisos de cada edificio; período aproximado 0,1 s por piso (regla práctica de la ingeniería sísmica). */
export const FLOORS = [2, 10, 30];
export const periodOf = (floors: number) => +(0.1 * floors).toFixed(2);
const FLOOR_M = 3;

const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

type Props = { lang: Lang; clock: Clock; synth: Synth };

export function Buildings({ lang, clock, synth }: Props) {
  const t = SIM_TEXT[lang];
  const { now, subscribe } = clock;
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);
  const floorPx = Math.max(3, Math.min(6, (h - 40) / 31));
  // Misma exageración para los tres: así se comparan de verdad.
  const exag = useMemo(() => {
    const maxU = Math.max(...synth.buildings.map((b) => b.drift), 1e-6);
    const want = 26 / ((floorPx / FLOOR_M) * maxU);
    return NICE.reduce((best, k) => (k <= want ? k : best), 1);
  }, [synth, floorPx]);

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas || !w) return;
    const ground = h - 8, slot = w / FLOORS.length;
    const draw = (time: number) => {
      const ctx = prep(canvas, w, h, dpr);
      if (!ctx) return;
      ctx.fillStyle = '#e2e0d8'; ctx.fillRect(0, ground, w, h - ground);
      ctx.strokeStyle = '#141414'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(w, ground); ctx.stroke();
      const i = Math.max(0, Math.min(synth.acc.length - 1, Math.floor(time / synth.dt)));
      synth.buildings.forEach((b, k) => {
        const floors = FLOORS[k], H = floors * floorPx, bw = Math.min(slot * 0.42, 22 + floors * 0.9);
        const cx = slot * (k + 0.5);
        const u = (b.u[i] ?? 0) * (floorPx / FLOOR_M) * exag; // px en el techo
        // Forma deformada (primer modo de un edificio de corte, aproximado): desplazamiento ∝ sen(π·y / 2H).
        const off = (y: number) => u * Math.sin((Math.PI * y) / (2 * H));
        ctx.beginPath();
        const steps = Math.max(4, floors);
        for (let s = 0; s <= steps; s++) { const y = (H * s) / steps; ctx.lineTo(cx - bw / 2 + off(y), ground - y); }
        for (let s = steps; s >= 0; s--) { const y = (H * s) / steps; ctx.lineTo(cx + bw / 2 + off(y), ground - y); }
        ctx.closePath();
        ctx.fillStyle = '#3d3d3a'; ctx.fill();
        // Losas.
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
        for (let f = 1; f < floors; f++) { const y = f * floorPx; ctx.beginPath(); ctx.moveTo(cx - bw / 2 + off(y) + 2, ground - y); ctx.lineTo(cx + bw / 2 + off(y) - 2, ground - y); ctx.stroke(); }
        // Posición de reposo del techo (referencia).
        ctx.strokeStyle = 'rgba(200,16,46,.6)'; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(cx, ground - H - 4); ctx.lineTo(cx, ground - H - 12); ctx.stroke(); ctx.setLineDash([]);
      });
      ctx.font = '11px var(--font-isans), system-ui, sans-serif'; ctx.fillStyle = '#6f6f6b'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(t.exaggerated(exag), w - 4, 4);
    };
    draw(now());
    return subscribe(draw);
  }, [w, h, dpr, now, subscribe, synth, exag, floorPx, t]);

  return (
    <div className="qs-bld">
      <div ref={wrap} className="qs-bld-canvas">
        <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" />
      </div>
      <div className="qs-bld-labels">
        {synth.buildings.map((b, k) => (
          <div key={b.T} className="qs-bld-label">
            <strong>{t.floors(FLOORS[k])}</strong>
            <span>{t.period} ≈ {fmtNum(lang, b.T, 1)} s</span>
            <span>{t.roof}: ±{fmtNum(lang, b.drift * 100, b.drift < 0.01 ? 1 : 0)} cm</span>
            <span>{t.sa}: {fmtNum(lang, b.sa, b.sa < 0.1 ? 3 : 2)} g</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Espectro de respuesta ───────────── */

export function Spectrum({ lang, spectrum, marks }: { lang: Lang; spectrum: { T: number; sa: Motion }[]; marks: { T: number; label: string }[] }) {
  const t = SIM_TEXT[lang];
  const W = 420, H = 222, L = 46, R = 12, T = 24, B = 34;
  const pts = spectrum.filter((p) => p.T >= 0.05 && p.T <= 10);
  const yMax = Math.max(...pts.map((p) => p.sa.median * Math.exp(p.sa.sigma))) * 1.05;
  // Coordenadas redondeadas: el servidor y el navegador no dan los mismos últimos decimales de exp/log.
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const X = (T_: number) => r1(L + ((Math.log10(T_) - Math.log10(0.05)) / (Math.log10(10) - Math.log10(0.05))) * (W - L - R));
  const Y = (v: number) => r1(T + (1 - v / yMax) * (H - T - B));
  const interp = (T_: number) => {
    for (let i = 1; i < pts.length; i++) if (T_ <= pts[i].T) {
      const a = pts[i - 1], b = pts[i], u = Math.log(T_ / a.T) / Math.log(b.T / a.T);
      return Math.exp(Math.log(a.sa.median) * (1 - u) + Math.log(b.sa.median) * u);
    }
    return pts[pts.length - 1].sa.median;
  };
  const line = (f: (p: (typeof pts)[number]) => number) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.T).toFixed(1)},${Y(f(p)).toFixed(1)}`).join('');
  const band = line((p) => p.sa.median * Math.exp(p.sa.sigma)) + [...pts].reverse().map((p) => `L${X(p.T).toFixed(1)},${Y(p.sa.median * Math.exp(-p.sa.sigma)).toFixed(1)}`).join('') + 'Z';
  const yStep = yMax > 1 ? 0.5 : yMax > 0.4 ? 0.1 : yMax > 0.2 ? 0.05 : yMax > 0.08 ? 0.02 : yMax > 0.04 ? 0.01 : 0.005;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += yStep) yTicks.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="qs-spectrum" role="img" aria-label={`${t.spectrum}: ${marks.map((m) => `${m.label} ${fmtNum(lang, interp(m.T), 2)} g`).join(', ')}`}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#e7e7e2" />
          <text x={L - 6} y={Y(v)} textAnchor="end" dominantBaseline="middle" className="qs-axis">{fmtNum(lang, v, yStep < 0.01 ? 3 : 2)}</text>
        </g>
      ))}
      {[0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].map((v) => (
        <text key={v} x={X(v)} y={H - B + 14} textAnchor="middle" className="qs-axis">{fmtNum(lang, v, v < 0.1 ? 2 : v < 1 ? 1 : 0)}</text>
      ))}
      <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className="qs-axis">{t.periodAxis}</text>
      <text x={L - 6} y={T - 14} textAnchor="end" className="qs-axis">g</text>
      <path d={band} fill="rgba(232,89,12,.14)" />
      <path d={line((p) => p.sa.median)} fill="none" stroke="#e8590c" strokeWidth={2} />
      {marks.map((m) => (
        <g key={m.T}>
          <line x1={X(m.T)} x2={X(m.T)} y1={Y(interp(m.T))} y2={H - B} stroke="#3d3d3a" strokeDasharray="2 3" />
          <circle cx={X(m.T)} cy={Y(interp(m.T))} r={4.5} fill="#3d3d3a" stroke="#fff" strokeWidth={1.5} />
          <text x={X(m.T)} y={Y(interp(m.T)) - 9} textAnchor="middle" className="qs-axis qs-strong">{m.label}</text>
        </g>
      ))}
    </svg>
  );
}
