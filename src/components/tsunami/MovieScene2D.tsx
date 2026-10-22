'use client';
/*
 * Película del tsunami en 2D, para equipos sin 3D o con poca memoria: mismos capítulos y datos. La fuente y el
 * nacimiento de la ola se ven en planta (la deformación del fondo y la ola en la grilla fina), el océano con el
 * mapa del simulador y la costa con el perfil de la orilla.
 */
import { useEffect, useMemo, useRef } from 'react';
import { chapterAt, simTimeAt } from '@/lib/tsunami/movie';
import { fmtNum } from '@/lib/format';
import { prep, useCanvasSize, type Clock } from '../quake/clock';
import { OceanMap } from './OceanMap';
import { drawBeach } from './beach';
import type { SceneProps } from './movieTypes';

export default function MovieScene2D(p: SceneProps) {
  const { clock } = p;
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);
  // Reloj del tiempo simulado para el mapa del océano (se mueve con la película).
  const simClock = useMemo<Clock>(() => ({
    now: () => simTimeAt(clock.now(), p.timing).t,
    subscribe: (fn) => clock.subscribe((mt) => fn(simTimeAt(mt, p.timing).t)),
    playing: false, shown: 0, play: () => {}, pause: () => {}, seek: () => {}, speed: 1, setSpeed: () => {}, end: p.timing.hours * 3600,
  }), [clock, p.timing]);
  const oceanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas || !w) return;
    const L = p.local, F = p.fine;
    const off = document.createElement('canvas'); off.width = L.nx; off.height = L.ny;
    const octx = off.getContext('2d')!, img = octx.createImageData(L.nx, L.ny), d = img.data;
    const draw = (mt: number) => {
      const c = chapterAt(mt), { t, rupture } = simTimeAt(mt, p.timing);
      const showOcean = c.id === 'ocean' || c.id === 'end';
      if (oceanRef.current) oceanRef.current.style.display = showOcean ? 'block' : 'none';
      canvas.style.display = showOcean ? 'none' : 'block';
      if (showOcean) return;
      const ctx = prep(canvas, w, h, dpr);
      if (!ctx) return;
      if (c.id === 'coast') {
        const S = p.shore, i = Math.max(0, Math.min(S.length - 1, t / p.shoreDt)), a = Math.floor(i), b = Math.min(S.length - 1, a + 1);
        const level = S[a] * (1 - (i - a)) + S[b] * (i - a);
        drawBeach(ctx, w, h, level, p.shoreYMax, mt * 30, `${level >= 0 ? '+' : '−'}${fmtNum(p.lang, Math.abs(level), 1)} m`);
        return;
      }
      // Fuente y nacimiento de la ola, en planta.
      const fi = Math.min(L.frames.length - 1, t / L.frameS), a = Math.floor(fi), b = Math.min(L.frames.length - 1, a + 1), u = fi - a;
      for (let j = 0; j < L.ny; j++) for (let i = 0; i < L.nx; i++) {
        const k = j * L.nx + i, q = ((L.ny - 1 - j) * L.nx + i) * 4, wet = L.h[k] >= 10;
        const v = c.id === 'quake' ? F.dz[k] * rupture : wet ? L.frames[a][k] * (1 - u) + L.frames[b][k] * u : 0;
        const m = Math.min(1, Math.sqrt(Math.abs(v) / 4));
        const base = wet ? [60 + 140 * (1 - Math.min(1, L.h[k] / 7000)), 110 + 110 * (1 - Math.min(1, L.h[k] / 7000)), 170 + 60 * (1 - Math.min(1, L.h[k] / 7000))] : [214, 205, 180];
        const tint = v > 0 ? [214, 40, 57] : [28, 80, 200];
        for (let z = 0; z < 3; z++) d[q + z] = base[z] * (1 - m) + tint[z] * m;
        d[q + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      const s = Math.min(w / L.nx, h / L.ny), dw = L.nx * s, dh = L.ny * s;
      ctx.fillStyle = '#0d1b2a'; ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };
    draw(clock.now());
    return clock.subscribe(draw);
  }, [w, h, dpr, clock, p.local, p.fine, p.timing, p.shore, p.shoreDt, p.shoreYMax, p.lang]);

  return (
    <div className="mv-2d">
      <div ref={wrap} className="mv-2d-canvas"><canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" /></div>
      <div ref={oceanRef} className="mv-2d-ocean" style={{ display: 'none' }}>
        <OceanMap lang={p.lang} clock={simClock} grid={p.grid} wet={p.wet} box={p.box} frames={p.frames} frameS={p.frameS} amp={p.amp} arrival={null} gauges={p.gauges} sites={p.sites} epi={p.epi} />
      </div>
    </div>
  );
}
