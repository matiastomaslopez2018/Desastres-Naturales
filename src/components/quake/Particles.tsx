'use client';
/*
 * Movimiento de las partículas con cada tipo de onda (P, S, Love y Rayleigh), animado.
 * Rayleigh: solución de Lamb (1904) para un semiespacio con coeficiente de Poisson 0,25 (λ = μ), con
 * profundidad z hacia abajo y la onda viajando hacia +x:
 *   u_x = −A·(e^(−0,8475·kz) − 0,5773·e^(−0,3933·kz))·sen(kx − ωt)
 *   u_↑ = −A·(−0,8475·e^(−0,8475·kz) + 1,4679·e^(−0,3933·kz))·cos(kx − ωt)
 * En la superficie la elipse es retrógrada (en lo alto la partícula va hacia atrás), con relación vertical/
 * horizontal ≈ 1,47, y el sentido se invierte a 0,19 longitudes de onda de profundidad.
 */
import { useEffect, useRef } from 'react';
import { SIM_TEXT } from '@/lib/quake/text';
import type { Lang } from '@/lib/types';
import { prep, useCanvasSize } from './clock';

type Kind = 'P' | 'S' | 'Love' | 'Rayleigh';
const COLORS: Record<Kind, string> = { P: '#e8590c', S: '#0c8599', Love: '#7048e8', Rayleigh: '#ae3ec9' };

function Panel({ kind, caption }: { kind: Kind; caption: string }) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);
  useEffect(() => {
    const canvas = cv.current;
    if (!canvas || !w) return;
    let raf = 0, visible = true, t0 = performance.now();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { t0 = performance.now() - 0; loop(); } });
    io.observe(canvas);
    const cols = Math.max(14, Math.round(w / 16)), rows = kind === 'Rayleigh' ? 9 : 6;
    const padX = 14, padY = 16, dx = (w - 2 * padX) / (cols - 1), dy = (h - 2 * padY) / (rows - 1);
    const lambda = (w - 2 * padX) / 1.6, k = (2 * Math.PI) / lambda, omega = (2 * Math.PI) / 2.2;
    const A = Math.min(dx, dy) * 0.55;
    const draw = (time: number) => {
      const ctx = prep(canvas, w, h, dpr);
      if (!ctx) return;
      // Superficie libre arriba en Rayleigh y Love (en Love, vista desde arriba: no hay superficie).
      if (kind === 'Rayleigh') { ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, w, padY - 4); ctx.strokeStyle = '#141414'; ctx.beginPath(); ctx.moveTo(0, padY - 4); ctx.lineTo(w, padY - 4); ctx.stroke(); }
      for (let j = 0; j < rows; j++) {
        // Profundidad en longitudes de onda (Rayleigh): de 0 a ~0,55 λ.
        const kz = kind === 'Rayleigh' ? (j / (rows - 1)) * 0.55 * 2 * Math.PI : 0;
        const fx = Math.exp(-0.8475 * kz) - 0.5773 * Math.exp(-0.3933 * kz);
        const fz = -0.8475 * Math.exp(-0.8475 * kz) + 1.4679 * Math.exp(-0.3933 * kz);
        for (let i = 0; i < cols; i++) {
          const x0 = padX + i * dx, y0 = padY + j * dy, ph = k * (x0 - padX) - omega * time;
          let ux = 0, uy = 0;
          if (kind === 'P') ux = A * Math.cos(ph);
          else if (kind === 'S') uy = -A * Math.cos(ph);
          else if (kind === 'Love') uy = -A * Math.cos(ph) * (1 - 0.25 * (j / (rows - 1)));
          // Rayleigh: uy es el desplazamiento hacia abajo (−u_↑), que en pantalla suma a y.
          else { ux = -(A / 1.47) * fx * Math.sin(ph); uy = (A / 1.47) * fz * Math.cos(ph); }
          const px = x0 + ux, py = y0 + uy;
          ctx.fillStyle = i === Math.round(cols / 2) ? COLORS[kind] : 'rgba(20,20,20,.65)';
          ctx.beginPath(); ctx.arc(px, py, i === Math.round(cols / 2) ? 3.6 : 2.4, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Trayectoria de la partícula marcada (Rayleigh: elipses a cada profundidad).
      if (kind === 'Rayleigh') {
        ctx.strokeStyle = 'rgba(174,62,201,.45)'; ctx.lineWidth = 1;
        const i = Math.round(cols / 2), x0 = padX + i * dx;
        for (let j = 0; j < rows; j++) {
          const kz = (j / (rows - 1)) * 0.55 * 2 * Math.PI, y0 = padY + j * dy;
          const ax = (A / 1.47) * Math.abs(Math.exp(-0.8475 * kz) - 0.5773 * Math.exp(-0.3933 * kz));
          const az = (A / 1.47) * Math.abs(-0.8475 * Math.exp(-0.8475 * kz) + 1.4679 * Math.exp(-0.3933 * kz));
          ctx.beginPath(); ctx.ellipse(x0, y0, Math.max(0.5, ax), Math.max(0.5, az), 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // Flecha de propagación.
      ctx.fillStyle = '#6f6f6b'; ctx.strokeStyle = '#6f6f6b'; ctx.lineWidth = 1.5;
      const ay = h - 6;
      ctx.beginPath(); ctx.moveTo(w - 60, ay); ctx.lineTo(w - 16, ay); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w - 12, ay); ctx.lineTo(w - 20, ay - 4); ctx.lineTo(w - 20, ay + 4); ctx.closePath(); ctx.fill();
    };
    const loop = () => {
      cancelAnimationFrame(raf);
      const step = () => { if (!visible) return; draw((performance.now() - t0) / 1000); raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    };
    draw(0);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [w, h, dpr, kind]);
  return (
    <figure className="qs-particle">
      <div ref={wrap} className="qs-particle-canvas"><canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" /></div>
      <figcaption><b style={{ color: COLORS[kind] }}>{kind}</b> · {caption}</figcaption>
    </figure>
  );
}

export function Particles({ lang }: { lang: Lang }) {
  const t = SIM_TEXT[lang];
  return (
    <div className="qs-particles">
      {t.motions.map(([k, cap]) => <Panel key={k} kind={k as Kind} caption={cap} />)}
    </div>
  );
}
