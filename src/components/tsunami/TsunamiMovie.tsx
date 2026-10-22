'use client';
/*
 * La película del tsunami. La escena 3D (three.js) se descarga recién acá; en equipos sin WebGL2 o con poca
 * memoria, o si el 3D falla, se usa la versión 2D con los mismos capítulos.
 */
import { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { CHAPTERS, captions, chapterAt, simTimeAt, type MovieFacts } from '@/lib/tsunami/movie';
import { MoviePlayer, type MovieMode, type PlayerClock } from '../movie/MoviePlayer';
import type { MovieInput } from './movieTypes';

const Scene3D = dynamic(() => import('./MovieScene3D'), { ssr: false, loading: () => <div className="mv-loading">…</div> });
const Scene2D = dynamic(() => import('./MovieScene2D'), { ssr: false, loading: () => <div className="mv-loading">…</div> });

const T = {
  es: { exag: 'Alturas exageradas para que se vean', chapters: { quake: 'El sismo', birth: 'Nace la ola', ocean: 'El océano', coast: 'La costa', end: 'Final' } },
  en: { exag: 'Heights exaggerated so they can be seen', chapters: { quake: 'The earthquake', birth: 'The wave is born', ocean: 'The ocean', coast: 'The coast', end: 'End' } },
};

export default function TsunamiMovie({ input, facts, onClose }: { input: MovieInput; facts: MovieFacts; onClose: () => void }) {
  const t = T[input.lang];
  const chapters = useMemo(() => CHAPTERS.map((c) => ({ ...c, label: t.chapters[c.id] })), [t]);
  const caption = useCallback((mt: number, mode: MovieMode) => {
    const ch = chapterAt(mt), cap = captions(input.lang, facts, simTimeAt(mt, input.timing).t)[ch.id];
    return { ...cap, note: (ch.id === 'quake' || ch.id === 'birth' || ch.id === 'ocean') && mode === '3d' ? t.exag : null };
  }, [input.lang, input.timing, facts, t]);
  const scene = useCallback((mode: MovieMode, clock: PlayerClock, fail: () => void) =>
    mode === '3d' ? <Scene3D {...input} clock={clock} onFail={fail} /> : <Scene2D {...input} clock={clock} onFail={() => {}} />, [input]);
  return <MoviePlayer lang={input.lang} chapters={chapters} caption={caption} scene={scene} onClose={onClose} />;
}
