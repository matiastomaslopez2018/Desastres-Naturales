'use client';

import { useEffect, useRef } from 'react';

/*
 * "Pelota de playa" del mecanismo focal: proyección de áreas iguales del hemisferio inferior.
 * Cada píxel es una dirección de salida de las ondas; se pinta donde la onda P sale en
 * compresión (signo de (n·x)(s·x) > 0, con n normal a la falla y s el deslizamiento).
 */

const RAD = Math.PI / 180;

function vectors(strike: number, dip: number, rake: number) {
  const f = strike * RAD, d = dip * RAD, l = rake * RAD;
  const n = [-Math.sin(d) * Math.sin(f), Math.sin(d) * Math.cos(f), -Math.cos(d)];
  const s = [Math.cos(l) * Math.cos(f) + Math.cos(d) * Math.sin(l) * Math.sin(f), Math.cos(l) * Math.sin(f) - Math.cos(d) * Math.sin(l) * Math.cos(f), -Math.sin(l) * Math.sin(d)];
  return { n, s };
}

export function Beachball({ strike, dip, rake, size = 132, label }: { strike: number; dip: number; rake: number; size?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const N = Math.round(size * dpr);
    c.width = N; c.height = N;
    const img = ctx.createImageData(N, N);
    const { n, s } = vectors(strike, dip, rake);
    const ink = getComputedStyle(c).color || '#c8102e';
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(ink) ?? ['', '200', '16', '46'];
    const [r, g, b] = [+m[1], +m[2], +m[3]];
    const half = N / 2;
    for (let py = 0; py < N; py++) {
      for (let px = 0; px < N; px++) {
        const x = (px + 0.5 - half) / half, y = (half - py - 0.5) / half; // x este, y norte
        const rr = Math.hypot(x, y);
        if (rr > 1) continue;
        const i = 2 * Math.asin(Math.min(1, rr / Math.SQRT2)); // ángulo de salida (área igual)
        const az = Math.atan2(x, y);
        const v = [Math.sin(i) * Math.cos(az), Math.sin(i) * Math.sin(az), Math.cos(i)];
        const p = (n[0] * v[0] + n[1] * v[1] + n[2] * v[2]) * (s[0] * v[0] + s[1] * v[1] + s[2] * v[2]);
        const k = (py * N + px) * 4;
        // Borde suavizado: el último píxel del círculo a media opacidad.
        const a = rr > 1 - 1.5 / half ? 160 : 255;
        if (p > 0) { img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = a; }
        else { img.data[k] = 255; img.data[k + 1] = 255; img.data[k + 2] = 255; img.data[k + 3] = a; }
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.beginPath(); ctx.arc(half, half, half - dpr, 0, Math.PI * 2);
    ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = '#1a1a1a'; ctx.stroke();
  }, [strike, dip, rake, size]);
  return <canvas ref={ref} className="beachball" style={{ width: size, height: size }} role="img" aria-label={label} />;
}
