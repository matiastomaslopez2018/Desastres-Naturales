'use client';
/*
 * La película del tsunami: superposición a pantalla completa que se reproduce sola, con capítulos, textos y
 * controles de video. La escena 3D (three.js) se descarga recién acá; en equipos sin WebGL2 o con poca
 * memoria, o si el 3D falla, se usa la versión 2D con los mismos capítulos.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { CHAPTERS, MOVIE_S, captions, chapterAt, simTimeAt, type MovieFacts } from '@/lib/tsunami/movie';
import { useClock } from '../quake/clock';
import type { MovieInput } from './movieTypes';

const Scene3D = dynamic(() => import('./MovieScene3D'), { ssr: false, loading: () => <div className="mv-loading">…</div> });
const Scene2D = dynamic(() => import('./MovieScene2D'), { ssr: false, loading: () => <div className="mv-loading">…</div> });

const T = {
  es: { close: 'Cerrar', play: 'Reproducir', pause: 'Pausa', replay: 'Ver de nuevo', full: 'Pantalla completa', mode3d: 'Ver en 3D', mode2d: 'Ver en 2D', exag: 'Alturas exageradas para que se vean', chapters: { quake: 'El sismo', birth: 'Nace la ola', ocean: 'El océano', coast: 'La costa', end: 'Final' }, fallback: 'Se muestra en 2D: este dispositivo no tiene gráficos 3D suficientes.' },
  en: { close: 'Close', play: 'Play', pause: 'Pause', replay: 'Watch again', full: 'Full screen', mode3d: 'View in 3D', mode2d: 'View in 2D', exag: 'Heights exaggerated so they can be seen', chapters: { quake: 'The earthquake', birth: 'The wave is born', ocean: 'The ocean', coast: 'The coast', end: 'End' }, fallback: 'Shown in 2D: this device lacks enough 3D graphics.' },
};

/** ¿Conviene el 3D? WebGL2 disponible y equipo con memoria y núcleos razonables. */
function canDo3D() {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    const nav = navigator as Navigator & { deviceMemory?: number };
    if ((nav.deviceMemory ?? 8) < 4 || (navigator.hardwareConcurrency ?? 8) < 4) return false;
    return true;
  } catch { return false; }
}

export default function TsunamiMovie({ input, facts, onClose }: { input: MovieInput; facts: MovieFacts; onClose: () => void }) {
  const t = T[input.lang];
  const [mode, setMode] = useState<'3d' | '2d'>(() => (canDo3D() ? '3d' : '2d'));
  const [fellBack, setFellBack] = useState(false);
  const clock = useClock(MOVIE_S);
  const root = useRef<HTMLDivElement>(null), fade = useRef<HTMLDivElement>(null), closeBtn = useRef<HTMLButtonElement>(null);
  const movieClock = useMemo(() => ({ now: clock.now, subscribe: clock.subscribe }), [clock.now, clock.subscribe]);

  // Arranca solo; bloquea el scroll de la página; Esc cierra.
  useEffect(() => {
    clock.play();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === ' ') { e.preventDefault(); (clock.playing ? clock.pause : clock.play)(); } };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Fundido a negro en los cambios de capítulo.
  useEffect(() => clock.subscribe((mt) => {
    const d = Math.min(...CHAPTERS.slice(1).map((c) => Math.abs(mt - c.start)));
    if (fade.current) fade.current.style.opacity = String(Math.max(0, 1 - d / 0.45));
  }), [clock]);

  const mt = clock.shown, ch = chapterAt(mt), simT = simTimeAt(mt, input.timing).t;
  const cap = captions(input.lang, facts, simT)[ch.id];
  const ended = mt >= MOVIE_S - 0.05;
  const fail = () => { setFellBack(true); setMode('2d'); };

  return (
    <div ref={root} className="mv" role="dialog" aria-modal="true" aria-label={cap.title}>
      <div className="mv-stage">
        {mode === '3d' ? <Scene3D {...input} clock={movieClock} onFail={fail} /> : <Scene2D {...input} clock={movieClock} onFail={() => {}} />}
        <div ref={fade} className="mv-fade" aria-hidden="true" />
        <div className="mv-caption" aria-live="polite">
          <p className="mv-title">{cap.title}</p>
          <p className="mv-text">{cap.text}</p>
          {(ch.id === 'quake' || ch.id === 'birth' || ch.id === 'ocean') && mode === '3d' && <p className="mv-note">{t.exag}</p>}
          {fellBack && <p className="mv-note">{t.fallback}</p>}
        </div>
        <button ref={closeBtn} type="button" className="mv-close" onClick={onClose} aria-label={t.close}>×</button>
      </div>
      <div className="mv-bar">
        <button type="button" className="mv-btn" onClick={() => (ended ? (clock.seek(0), clock.play()) : clock.playing ? clock.pause() : clock.play())}>
          {ended ? t.replay : clock.playing ? t.pause : t.play}
        </button>
        <div className="mv-chapters">
          {CHAPTERS.map((c) => {
            const fill = Math.max(0, Math.min(1, (mt - c.start) / (c.end - c.start)));
            return (
              <button key={c.id} type="button" className="mv-chapter" style={{ flex: c.end - c.start }} onClick={() => clock.seek(c.start + 0.01)} aria-current={c.id === ch.id ? 'step' : undefined}>
                <span className="mv-chapter-fill" style={{ width: `${fill * 100}%` }} />
                <span className="mv-chapter-label">{t.chapters[c.id]}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="mv-btn mv-ghost" onClick={() => { setFellBack(false); setMode(mode === '3d' ? '2d' : '3d'); }}>{mode === '3d' ? t.mode2d : t.mode3d}</button>
        <button type="button" className="mv-btn mv-ghost" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen?.())}>{t.full}</button>
      </div>
    </div>
  );
}
