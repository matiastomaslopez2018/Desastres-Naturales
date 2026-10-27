'use client';
/*
 * "En erupción ahora": volcanes con un aviso de ceniza vigente (SIGMET de la NOAA). Los que están en el
 * simulador se pueden simular con un toque; se vuelve a consultar cada 10 minutos.
 */
import { useEffect, useState } from 'react';
import type { LiveAsh } from '@/lib/server/volcanicAsh';
import { VOLC_TEXT } from '@/lib/volcano/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';

const DIRS: Record<Lang, string[]> = {
  es: ['norte', 'noreste', 'este', 'sudeste', 'sur', 'sudoeste', 'oeste', 'noroeste'],
  en: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
};
const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);

export function LiveAshList({ lang, current, onPick, hours }: { lang: Lang; current: LiveAsh | null; onPick: (a: LiveAsh) => void; hours: string }) {
  const t = VOLC_TEXT[lang].live, nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const [list, setList] = useState<LiveAsh[] | 'loading' | 'failed'>('loading');
  useEffect(() => {
    let ok = true;
    const load = () => fetch('/api/volcanic-ash').then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { active: LiveAsh[] }) => { if (ok) setList(j.active); })
      .catch(() => { if (ok) setList((l) => (Array.isArray(l) ? l : 'failed')); });
    load();
    const id = setInterval(load, 10 * 6e4);
    return () => { ok = false; clearInterval(id); };
  }, []);

  return (
    <div className="qs-block vs-live">
      <h2 className="qs-h"><span className="vs-live-dot" aria-hidden="true" />{t.title}</h2>
      <p className="qs-help">{t.intro}</p>
      {list === 'loading' ? <p className="qs-help">{t.loading}</p> : list === 'failed' ? <p className="qs-help">{t.failed}</p> : !list.length ? <p className="qs-help">{t.none}</p> : (
        <ul className="vs-live-list">
          {list.map((a) => (
            <li key={`${a.name}-${a.lon}`}>
              {a.sim ? (
                <button type="button" className="qs-chip" aria-pressed={current?.name === a.name} onClick={() => onPick(a)}>
                  {a.name} <small>· {t.top(nf(a.topKm, 1))}</small>
                </button>
              ) : (
                <span className="vs-live-off">{a.name}{a.country ? ` (${a.country[lang]})` : ''} <small>· {t.top(nf(a.topKm, 1))} · {t.noSim}</small></span>
              )}
            </li>
          ))}
        </ul>
      )}
      {current && (
        <>
          <p className="qs-note">{t.detail(nf(current.topKm, 1), current.moveTo != null && current.moveKmh ? t.move(DIRS[lang][Math.round(current.moveTo / 45) % 8], nf(current.moveKmh)) : null, hhmm(current.validFrom), hhmm(current.validTo))}</p>
          <p className="qs-help">{t.assume(hours)}</p>
        </>
      )}
      <p className="qs-warn">{t.warn}</p>
      <p className="qs-help">{t.src}</p>
    </div>
  );
}
