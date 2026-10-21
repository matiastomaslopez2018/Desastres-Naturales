'use client';
/* Sismograma sintético en el lugar: se dibuja a medida que pasa el tiempo, con las llegadas P y S. */
import { useEffect, useRef } from 'react';
import type { Synth } from '@/lib/quake/synth';
import { SIM_TEXT } from '@/lib/quake/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { niceStep, prep, useCanvasSize, type Clock } from './clock';
import { P_RGB, S_RGB } from './Section';

type Props = { lang: Lang; clock: Clock; synth: Synth; tP: number; tS: number; pga: number; end: number };

export function Seismogram({ lang, clock, synth, tP, tS, pga, end }: Props) {
  const t = SIM_TEXT[lang];
  const { now, subscribe, seek } = clock;
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas || !w) return;
    const L = 44, R = 12, T = 22, B = 22, pw = w - L - R, ph = h - T - B, mid = T + ph / 2;
    const yMax = Math.max(synth.peak, pga) * 1.15;
    const X = (s: number) => L + (s / end) * pw, Yv = (g: number) => mid - (g / yMax) * (ph / 2);
    const draw = (time: number) => {
      const ctx = prep(canvas, w, h, dpr);
      if (!ctx) return;
      ctx.font = '11px var(--font-isans), system-ui, sans-serif'; ctx.textBaseline = 'middle';
      // Ejes: tiempo y aceleración (en g y en % de g).
      ctx.strokeStyle = '#e7e7e2'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, mid); ctx.lineTo(w - R, mid); ctx.stroke();
      const st = niceStep(end, 8);
      ctx.fillStyle = '#6f6f6b'; ctx.textAlign = 'center';
      for (let s = 0; s <= end; s += st) { ctx.fillRect(X(s), h - B, 1, 4); ctx.fillText(`${fmtNum(lang, s)} s`, X(s), h - B + 12); }
      // Líneas de la PGA del modelo (±).
      ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(200,16,46,.55)';
      for (const sgn of [1, -1]) { ctx.beginPath(); ctx.moveTo(L, Yv(sgn * pga)); ctx.lineTo(w - R, Yv(sgn * pga)); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.textAlign = 'right'; ctx.fillStyle = '#c8102e';
      ctx.fillText(`${fmtNum(lang, pga, pga < 0.1 ? 3 : 2)} g`, L - 6, Yv(pga));
      ctx.fillStyle = '#6f6f6b'; ctx.fillText('0', L - 6, mid);
      // Llegadas P y S con su ventana.
      for (const [ta, col, lab] of [[tP, P_RGB, 'P'], [tS, S_RGB, 'S']] as const) {
        ctx.strokeStyle = `rgba(${col.join(',')},${time >= ta ? 0.9 : 0.35})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X(ta), T - 6); ctx.lineTo(X(ta), h - B); ctx.stroke();
        ctx.fillStyle = `rgb(${col.join(',')})`; ctx.textAlign = 'center'; ctx.font = '600 12px var(--font-isans), system-ui, sans-serif';
        ctx.fillText(lab, X(ta), T - 12);
        ctx.font = '11px var(--font-isans), system-ui, sans-serif';
      }
      if (X(tS) - X(tP) > 60) {
        ctx.fillStyle = '#5a5a5a'; ctx.textAlign = 'center';
        ctx.fillText(`S − P = ${fmtNum(lang, tS - tP, 1)} s`, (X(tP) + X(tS)) / 2, T - 12);
      }
      // Traza hasta el tiempo actual.
      const n = Math.min(synth.acc.length, Math.floor(Math.min(time, end) / synth.dt));
      const stride = Math.max(1, Math.floor(n / (pw * 2)));
      ctx.strokeStyle = '#141414'; ctx.lineWidth = 1;
      ctx.beginPath();
      // Por columna se dibuja el mínimo y el máximo (no se pierden picos al reducir).
      for (let i = 0; i < n; i += stride) {
        let lo = Infinity, hi = -Infinity;
        for (let k = i; k < Math.min(n, i + stride); k++) { const v = synth.acc[k]; if (v < lo) lo = v; if (v > hi) hi = v; }
        const x = X(i * synth.dt);
        if (i === 0) ctx.moveTo(x, Yv(lo)); else ctx.lineTo(x, Yv(lo));
        ctx.lineTo(x, Yv(hi));
      }
      ctx.stroke();
      // Cursor.
      if (time > 0 && time < end) { ctx.strokeStyle = 'rgba(20,20,20,.35)'; ctx.beginPath(); ctx.moveTo(X(time), T); ctx.lineTo(X(time), h - B); ctx.stroke(); }
    };
    draw(now());
    return subscribe(draw);
  }, [w, h, dpr, now, subscribe, synth, tP, tS, pga, end, lang]);

  // Tocar o arrastrar sobre el sismograma mueve el tiempo.
  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type === 'pointermove' && e.buttons !== 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - r.left - 44) / (r.width - 56)) * end);
  };

  return (
    <div ref={wrap} className="qs-seis">
      <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'pan-y' }} onPointerDown={onPointer} onPointerMove={onPointer}
        role="img" aria-label={`${t.seismogram}. ${t.waveP} ${fmtNum(lang, tP, 1)} s, ${t.waveS} ${fmtNum(lang, tS, 1)} s. ${t.pgaLine}: ${fmtNum(lang, pga, 3)} g.`} />
    </div>
  );
}
