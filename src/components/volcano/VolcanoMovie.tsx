'use client';
/*
 * La película del volcán: el volcán real, la erupción, dónde cae la ceniza, los otros peligros y la foto de
 * la erupción real. Usa la misma escena 3D del simulador con la cámara manejada por el guion; three.js ya
 * está cargado si se vio la escena. En equipos sin 3D se usa la imagen satelital y el mapa.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { V_CHAPTERS, animTimeAt, cameraAt, hazardAt, vCaptions, vChapterAt, type VChapterId, type VFacts } from '@/lib/volcano/movie';
import { energyCone, lahar, lavaFlow, type Dem } from '@/lib/volcano/hazards';
import type { Slot } from '@/lib/volcano/timeline';
import type { Style, Volcano } from '@/lib/volcano/presets';
import type { WindProfile } from '@/lib/volcano/tephra';
import type { Lang } from '@/lib/types';
import { MoviePlayer, type MovieMode, type PlayerClock } from '../movie/MoviePlayer';
import { AshMap } from './AshMap';
import type { AshOut } from './ash.worker';
import type { HazardLayer } from './VolcanoScene3D';

const Scene3D = dynamic(() => import('./VolcanoScene3D'), { ssr: false, loading: () => <div className="mv-loading">…</div> });

const T = {
  es: { chapters: { volcano: 'El volcán', eruption: 'La erupción', ash: 'La ceniza', hazards: 'Otros peligros', end: 'Final' }, exag: 'Relieve exagerado ×1,5', crater: 'Cráter', asl: 's. n. m.' },
  en: { chapters: { volcano: 'The volcano', eruption: 'The eruption', ash: 'The ash', hazards: 'Other hazards', end: 'End' }, exag: 'Relief exaggerated ×1.5', crater: 'Crater', asl: 'a.s.l.' },
};

export type VMovieInput = {
  lang: Lang; volcano: Volcano; style: Style; n: number;
  phases: { top: number; wind: WindProfile }[]; slots: Slot[]; masses: number[];
  ash: AshOut | null; dem: Dem | null; photo: string | null;
  facts: Omit<VFacts, 'lavaKm' | 'pdcKm' | 'laharKm' | 'laharChannels'>;
};

export default function VolcanoMovie({ input, onClose }: { input: VMovieInput; onClose: () => void }) {
  const { lang, volcano: v } = input, t = T[lang];
  // Peligros con valores típicos (los mismos modelos del simulador), una vez al abrir.
  const hz = useMemo(() => {
    if (!input.dem) return null;
    return {
      lava: lavaFlow(input.dem, { lengthM: 6000, runs: 400 }),
      pdc: energyCone(input.dem, { collapseM: 1000, angleDeg: 15 }),
      lahar: lahar(input.dem, { volume: 1e7 }),
    };
  }, [input.dem]);
  const facts: VFacts = useMemo(() => ({
    ...input.facts,
    lavaKm: (hz?.lava.reachM ?? 0) / 1000, pdcKm: (hz?.pdc.reachM ?? 0) / 1000, laharKm: (hz?.lahar.reachM ?? 0) / 1000, laharChannels: hz?.lahar.starts ?? 0,
  }), [input.facts, hz]);
  const chapters = useMemo(() => V_CHAPTERS.map((c) => ({ ...c, label: t.chapters[c.id] })), [t]);
  const caption = useCallback((mt: number, mode: MovieMode) => ({ ...vCaptions(lang, facts, mt), note: mode === '3d' && vChapterAt(mt).id !== 'ash' && vChapterAt(mt).id !== 'end' ? t.exag : null }), [lang, facts, t]);
  const animEnd = input.slots[input.slots.length - 1]?.end ?? 24;
  const columnM = Math.max(...input.phases.map((p) => p.top)) - v.elev;

  const scene = useCallback((mode: MovieMode, clock: PlayerClock, fail: () => void) => (
    <Stage input={input} hz={hz} clock={clock} mode={mode} fail={fail} animEnd={animEnd} columnM={columnM} labels={t} />
  ), [input, hz, animEnd, columnM, t]);
  return <MoviePlayer lang={lang} chapters={chapters} caption={caption} scene={scene} onClose={onClose} />;
}

type Hz = { lava: ReturnType<typeof lavaFlow>; pdc: ReturnType<typeof energyCone>; lahar: ReturnType<typeof lahar> } | null;

function Stage({ input, hz, clock, mode, fail, animEnd, columnM, labels }: { input: VMovieInput; hz: Hz; clock: PlayerClock; mode: MovieMode; fail: () => void; animEnd: number; columnM: number; labels: (typeof T)['es'] }) {
  const { volcano: v } = input;
  // Capítulo y peligro actuales (cambian pocas veces: el resto lo maneja la escena con el reloj).
  const [chapter, setChapter] = useState<VChapterId>(vChapterAt(clock.now()).id);
  const [hzKind, setHzKind] = useState(hazardAt(clock.now()));
  useEffect(() => clock.subscribe((mt) => { setChapter(vChapterAt(mt).id); setHzKind(hazardAt(mt)); }), [clock]);
  const sceneClock = useMemo(() => ({
    now: () => animTimeAt(clock.now(), animEnd),
    subscribe: (fn: (t: number) => void) => clock.subscribe((mt) => fn(animTimeAt(mt, animEnd))),
  }), [clock, animEnd]);
  const drive = useCallback(() => cameraAt(clock.now(), v.boxKm * 1000, columnM), [clock, v.boxKm, columnM]);
  const layer: HazardLayer | null = useMemo(() => (hz && hzKind ? { kind: hzKind, value: hz[hzKind].value, arrival: hz[hzKind].arrival, n: input.n } : null), [hz, hzKind, input.n]);

  return (
    <div className="vm-stage">
      {mode === '3d' ? (
        <Scene3D lang={input.lang} name={v.name} elev={v.elev} boxKm={v.boxKm} n={input.n}
          demUrl={`/data/volcano/${v.id}/dem.bin`} imageUrl={`/data/volcano/${v.id}/image.jpg`}
          style={input.style} phases={input.phases} slots={input.slots} masses={input.masses}
          local={input.ash?.local ?? null} localN={input.ash?.localN ?? 2} clock={sceneClock} onFail={fail}
          labels={{ crater: labels.crater, top: (km) => `${km} km ${labels.asl}` }} hazard={layer} drive={drive} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/data/volcano/${v.id}/image.jpg`} alt="" className="vm-flat" />
      )}
      <div className="vm-layer" style={{ opacity: chapter === 'ash' ? 1 : 0 }} aria-hidden={chapter !== 'ash'}>
        <div className="vm-map"><AshMap lang={input.lang} ash={input.ash} vent={[v.lon, v.lat]} name={v.name} computing={false} computingText="…" /></div>
      </div>
      {input.photo && (
        <div className="vm-layer vm-photo" style={{ opacity: chapter === 'end' ? 1 : 0 }} aria-hidden={chapter !== 'end'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={input.photo} alt="" />
        </div>
      )}
    </div>
  );
}
