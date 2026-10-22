'use client';
/*
 * Reproductor de las películas de los simuladores: superposición a pantalla completa que se reproduce sola,
 * con capítulos, textos y controles de video. Cada película pone su escena (3D o 2D) y sus textos; si el 3D
 * no conviene en el equipo o falla, se pasa a 2D.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useClock } from '../quake/clock';
import type { Lang } from '@/lib/types';

export type MovieMode = '3d' | '2d';
export type MovieChapter = { id: string; start: number; end: number; label: string };
export type PlayerClock = { now: () => number; subscribe: (fn: (t: number) => void) => () => void };

const T = {
  es: { close: 'Cerrar', play: 'Reproducir', pause: 'Pausa', replay: 'Ver de nuevo', full: 'Pantalla completa', mode3d: 'Ver en 3D', mode2d: 'Ver en 2D', fallback: 'Se muestra en 2D: este dispositivo no tiene gráficos 3D suficientes.' },
  en: { close: 'Close', play: 'Play', pause: 'Pause', replay: 'Watch again', full: 'Full screen', mode3d: 'View in 3D', mode2d: 'View in 2D', fallback: 'Shown in 2D: this device lacks enough 3D graphics.' },
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

type Props = {
  lang: Lang;
  chapters: MovieChapter[];
  /** Título y texto del momento `mt` (s de película), y una nota opcional al pie. */
  caption: (mt: number, mode: MovieMode) => { title: string; text: string; note?: string | null };
  scene: (mode: MovieMode, clock: PlayerClock, onFail: () => void) => ReactNode;
  onClose: () => void;
};

export function MoviePlayer({ lang, chapters, caption, scene, onClose }: Props) {
  const t = T[lang];
  const total = chapters[chapters.length - 1].end;
  const [mode, setMode] = useState<MovieMode>(() => (canDo3D() ? '3d' : '2d'));
  const [fellBack, setFellBack] = useState(false);
  const clock = useClock(total);
  const root = useRef<HTMLDivElement>(null), fade = useRef<HTMLDivElement>(null), closeBtn = useRef<HTMLButtonElement>(null);
  const movieClock = useMemo(() => ({ now: clock.now, subscribe: clock.subscribe }), [clock.now, clock.subscribe]);

  // Arranca solo; bloquea el scroll de la página; Esc cierra y la barra espaciadora pausa.
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
    const d = Math.min(...chapters.slice(1).map((c) => Math.abs(mt - c.start)));
    if (fade.current) fade.current.style.opacity = String(Math.max(0, 1 - d / 0.45));
  }), [clock, chapters]);

  const mt = clock.shown;
  const cap = caption(mt, mode);
  const current = chapters.find((c) => mt < c.end) ?? chapters[chapters.length - 1];
  const ended = mt >= total - 0.05;
  const fail = () => { setFellBack(true); setMode('2d'); };

  return (
    <div ref={root} className="mv" role="dialog" aria-modal="true" aria-label={cap.title}>
      <div className="mv-stage">
        {scene(mode, movieClock, fail)}
        <div ref={fade} className="mv-fade" aria-hidden="true" />
        <div className="mv-caption" aria-live="polite">
          <p className="mv-title">{cap.title}</p>
          <p className="mv-text">{cap.text}</p>
          {cap.note && <p className="mv-note">{cap.note}</p>}
          {fellBack && <p className="mv-note">{t.fallback}</p>}
        </div>
        <button ref={closeBtn} type="button" className="mv-close" onClick={onClose} aria-label={t.close}>×</button>
      </div>
      <div className="mv-bar">
        <button type="button" className="mv-btn" onClick={() => (ended ? (clock.seek(0), clock.play()) : clock.playing ? clock.pause() : clock.play())}>
          {ended ? t.replay : clock.playing ? t.pause : t.play}
        </button>
        <div className="mv-chapters">
          {chapters.map((c) => {
            const fill = Math.max(0, Math.min(1, (mt - c.start) / (c.end - c.start)));
            return (
              <button key={c.id} type="button" className="mv-chapter" style={{ flex: c.end - c.start }} onClick={() => clock.seek(c.start + 0.01)} aria-current={c.id === current.id ? 'step' : undefined}>
                <span className="mv-chapter-fill" style={{ width: `${fill * 100}%` }} />
                <span className="mv-chapter-label">{c.label}</span>
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
