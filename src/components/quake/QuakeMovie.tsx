'use client';
/*
 * La película del sismo. La escena 3D (three.js) se descarga recién acá; en equipos sin WebGL2 o con poca
 * memoria, o si el 3D falla, se usa la versión 2D con los mismos capítulos.
 */
import { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Q_CHAPTERS, qCaptions, qChapterAt, qSimTimeAt, type QFacts } from '@/lib/quake/movie';
import { SIM_TEXT } from '@/lib/quake/text';
import { fmtNum } from '@/lib/format';
import { MoviePlayer, type MovieMode, type PlayerClock } from '../movie/MoviePlayer';
import type { QMovieInput } from './movieGeo';

const Scene3D = dynamic(() => import('./QuakeScene3D'), { ssr: false, loading: () => <div className="mv-loading">…</div> });
const Scene2D = dynamic(() => import('./QuakeScene2D'), { ssr: false, loading: () => <div className="mv-loading">…</div> });

const T = {
  es: { chapters: { fault: 'La falla', waves: 'Las ondas', city: 'La ciudad', end: 'Final' }, ve: (k: string) => `Profundidad exagerada ×${k}` },
  en: { chapters: { fault: 'The fault', waves: 'The waves', city: 'The city', end: 'End' }, ve: (k: string) => `Depth exaggerated ×${k}` },
};

export default function QuakeMovie({ input, facts, onClose }: { input: QMovieInput; facts: QFacts; onClose: () => void }) {
  const lang = input.lang, t = T[lang];
  const chapters = useMemo(() => Q_CHAPTERS.map((c) => ({ ...c, label: t.chapters[c.id] })), [t]);
  const caption = useCallback((mt: number, mode: MovieMode) => {
    const ch = qChapterAt(mt), cap = qCaptions(lang, facts, qSimTimeAt(mt, input.timing).t)[ch.id];
    const note = mode !== '3d' ? null
      : ch.id === 'city' ? SIM_TEXT[lang].exaggerated(input.block.exag)
      : (ch.id === 'fault' || ch.id === 'waves') && input.view.ve > 1 ? t.ve(fmtNum(lang, input.view.ve, input.view.ve % 1 ? 1 : 0)) : null;
    return { ...cap, note };
  }, [lang, facts, input.timing, input.block.exag, input.view.ve, t]);
  const scene = useCallback((mode: MovieMode, clock: PlayerClock, fail: () => void) =>
    mode === '3d' ? <Scene3D {...input} clock={clock} onFail={fail} /> : <Scene2D {...input} clock={clock} onFail={() => {}} />, [input]);
  return <MoviePlayer lang={lang} chapters={chapters} caption={caption} scene={scene} onClose={onClose} />;
}
