'use client';
/*
 * Película del sismo en 2D, para equipos sin 3D o con poca memoria: mismos capítulos, con el corte de la
 * Tierra para la falla y las ondas, y la cuadra para el sacudón (los mismos dibujos de la página, movidos
 * por el reloj de la película).
 */
import { useEffect, useMemo, useRef } from 'react';
import { qChapterAt, qSimTimeAt } from '@/lib/quake/movie';
import type { Clock } from './clock';
import { Section } from './Section';
import { City } from './City';
import type { QSceneProps } from './movieGeo';

export default function QuakeScene2D(p: QSceneProps) {
  const { clock } = p;
  const simClock = useMemo<Clock>(() => ({
    now: () => qSimTimeAt(clock.now(), p.timing).t,
    subscribe: (fn) => clock.subscribe((mt) => fn(qSimTimeAt(mt, p.timing).t)),
    playing: false, shown: 0, play: () => {}, pause: () => {}, seek: () => {}, speed: 1, setSpeed: () => {}, end: p.end,
  }), [clock, p.timing, p.end]);
  const sec = useRef<HTMLDivElement>(null), cty = useRef<HTMLDivElement>(null);

  useEffect(() => clock.subscribe((mt) => {
    const id = qChapterAt(mt).id, isCity = id === 'city' || id === 'end';
    if (sec.current) sec.current.style.display = isCity ? 'none' : 'flex';
    if (cty.current) cty.current.style.display = isCity ? 'flex' : 'none';
  }), [clock]);

  return (
    <div className="mv-2d mv-q2d">
      <div ref={sec} className="mv-q2d-pane">
        <Section lang={p.lang} clock={simClock} depth={p.depth} dist={p.dist} rup={p.rup} tP={p.tP} tS={p.tS} surface={!!p.surface} siteLabel={p.siteLabel} />
      </div>
      <div ref={cty} className="mv-q2d-pane" style={{ display: 'none' }}>
        <City lang={p.lang} clock={simClock} synth={p.synth} sh={p.sh} tP={p.tP.t} tS={p.tS.t} seed={p.seed} />
      </div>
    </div>
  );
}
