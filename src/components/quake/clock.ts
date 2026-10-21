'use client';
/*
 * Reloj de la animación: el tiempo vive en una referencia (no en el estado de React) y los lienzos se
 * suscriben para redibujarse en cada cuadro; la interfaz textual se actualiza a ~10 por segundo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type Clock = {
  /** Tiempo actual del sismo (s desde la hora de origen). */
  now: () => number;
  subscribe: (fn: (t: number) => void) => () => void;
  playing: boolean;
  /** Tiempo para mostrar en texto (se actualiza con menos frecuencia). */
  shown: number;
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  speed: number;
  setSpeed: (s: number) => void;
  end: number;
};

export function useClock(end: number): Clock {
  const tRef = useRef(0);
  const subs = useRef(new Set<(t: number) => void>());
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(0);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const endRef = useRef(end);
  endRef.current = end;

  // now y subscribe son estables: los lienzos se suscriben una sola vez.
  const now = useCallback(() => tRef.current, []);
  const subscribe = useCallback((fn: (t: number) => void) => { subs.current.add(fn); return () => { subs.current.delete(fn); }; }, []);
  const emit = useCallback(() => { for (const fn of subs.current) fn(tRef.current); }, []);
  const seek = useCallback((t: number) => { tRef.current = Math.max(0, Math.min(endRef.current, t)); setShown(tRef.current); emit(); }, [emit]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now(), lastShown = 0;
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tRef.current = Math.min(endRef.current, tRef.current + dt * speedRef.current);
      emit();
      if (now - lastShown > 100) { lastShown = now; setShown(tRef.current); }
      if (tRef.current >= endRef.current) { setShown(tRef.current); setPlaying(false); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Pestaña oculta: se pausa.
    const onVis = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
  }, [playing, emit]);

  return {
    now, subscribe,
    playing, shown, speed, setSpeed, end,
    play: () => { if (tRef.current >= endRef.current) tRef.current = 0; setPlaying(true); },
    pause: () => setPlaying(false),
    seek,
  };
}

/** Tamaño CSS del lienzo y su resolución (con tope de 2× para no gastar memoria). */
export function useCanvasSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height), dpr: Math.min(2, window.devicePixelRatio || 1) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Prepara un lienzo para dibujar en coordenadas CSS. */
export function prep(canvas: HTMLCanvasElement | null, w: number, h: number, dpr: number) {
  if (!canvas || !w || !h) return null;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

/** Paso "lindo" para ejes (1, 2, 5 × 10^n) que deja unas `n` marcas. */
export function niceStep(span: number, n = 5) {
  const raw = span / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
