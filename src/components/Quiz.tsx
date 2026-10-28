'use client';
/*
 * «¿Qué harías?»: una situación por vez, tres opciones (mezcladas), y al elegir se explica por qué cada una está
 * bien o mal, con el enlace a la guía y a la fuente. Al final, el puntaje.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GUIDE_SOURCES, GUIDE_T } from '@/lib/guides';
import { QUIZ } from '@/lib/quiz';
import { routePath } from '@/lib/seo';
import type { Lang } from '@/lib/types';

const T = {
  es: {
    of: (i: number, n: number) => `Situación ${i} de ${n}`, right: '¡Bien!', wrong: 'No es lo más seguro.',
    next: 'Siguiente →', finish: 'Ver resultado', guide: 'Guía completa', source: 'Fuente',
    score: (s: number, n: number) => `Acertaste ${s} de ${n}.`,
    verdict: (s: number, n: number) => (s === n ? 'Perfecto: sabés qué hacer en cada caso.' : s >= n * 0.7 ? 'Muy bien. Repasá las que fallaste: en una emergencia no hay tiempo para pensar.' : 'Conviene repasar las guías: saber qué hacer antes de que pase es lo que más protege.'),
    again: 'Volver a empezar', todo: 'Ver todas las guías de «Qué hacer»',
  },
  en: {
    of: (i: number, n: number) => `Situation ${i} of ${n}`, right: 'Well done!', wrong: 'That is not the safest choice.',
    next: 'Next →', finish: 'See result', guide: 'Full guide', source: 'Source',
    score: (s: number, n: number) => `You got ${s} of ${n} right.`,
    verdict: (s: number, n: number) => (s === n ? 'Perfect: you know what to do in every case.' : s >= n * 0.7 ? 'Very good. Review the ones you missed: in an emergency there is no time to think.' : 'Worth reviewing the guides: knowing what to do before it happens is what protects you most.'),
    again: 'Start again', todo: 'See all the “What to do” guides',
  },
};

/** Mezcla determinística por ronda (para que el servidor y el navegador coincidan en el primer render). */
const shuffle = <X,>(a: X[], seed: number) => {
  const out = a.map((x, i) => ({ x, k: Math.sin(seed * 9301 + i * 49297) })).sort((p, q) => p.k - q.k);
  return out.map((o) => o.x);
};

export function Quiz({ lang }: { lang: Lang }) {
  const t = T[lang], items = QUIZ[lang];
  const [round, setRound] = useState(1);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  // Semilla al azar recién en el navegador (la primera ronda usa una fija para el HTML del servidor).
  const [seed, setSeed] = useState(1);
  useEffect(() => { setSeed(Math.random() * 1000); }, [round]);

  const item = items[i];
  const opts = useMemo(() => shuffle(item.options.map((o, k) => ({ ...o, ok: k === 0 })), seed + i), [item, seed, i]);
  const src = GUIDE_SOURCES[item.src];
  const guideHref = `${routePath(lang, 'whatToDo')}#${GUIDE_T[lang].anchors[item.hazard]}`;

  const choose = (k: number) => {
    if (pick != null) return;
    setPick(k);
    if (opts[k].ok) setScore((s) => s + 1);
  };
  const next = () => {
    if (i + 1 >= items.length) { setDone(true); return; }
    setI(i + 1); setPick(null);
  };
  const restart = () => { setRound((r) => r + 1); setI(0); setPick(null); setScore(0); setDone(false); };

  if (done) return (
    <div className="qz qz-end">
      <p className="qz-score">{t.score(score, items.length)}</p>
      <p className="ed-body">{t.verdict(score, items.length)}</p>
      <div className="qz-actions">
        <button type="button" className="ed-button" onClick={restart}>{t.again}</button>
        <Link className="ed-more" href={routePath(lang, 'whatToDo')}>{t.todo} →</Link>
      </div>
    </div>
  );

  return (
    <div className="qz">
      <div className="qz-progress" aria-hidden="true"><span style={{ width: `${(i / items.length) * 100}%` }} /></div>
      <p className="qs-help">{t.of(i + 1, items.length)}</p>
      <h2 className="qz-q">{item.q}</h2>
      <div className="qz-opts" role="group" aria-label={item.q}>
        {opts.map((o, k) => {
          const state = pick == null ? '' : o.ok ? ' ok' : k === pick ? ' bad' : ' off';
          return (
            <button key={o.text} type="button" className={`qz-opt${state}`} onClick={() => choose(k)} disabled={pick != null} aria-pressed={pick === k}>
              <span>{o.text}</span>
              {pick != null && (o.ok || k === pick) && <small>{o.why}</small>}
            </button>
          );
        })}
      </div>
      {pick != null && (
        <div className="qz-after" role="status">
          <p className="ml-head">{opts[pick].ok ? t.right : t.wrong}</p>
          <p className="faint small">
            <Link href={guideHref}>{t.guide} →</Link> · {t.source}: <a href={src.url} target="_blank" rel="noopener noreferrer">{src.label} ↗</a>
          </p>
          <button type="button" className="ed-button" onClick={next}>{i + 1 >= items.length ? t.finish : t.next}</button>
        </div>
      )}
    </div>
  );
}
