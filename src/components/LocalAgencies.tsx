// Lo que informaron del mismo sismo el INPRES (Argentina) o el Centro Sismológico Nacional de Chile.
import { fmtNum } from '@/lib/format';
import { csnPlace } from '@/lib/localize';
import type { LocalReport, Lang } from '@/lib/types';

const T = {
  es: {
    title: 'Según los organismos nacionales', mag: 'Magnitud', depth: 'Profundidad', felt: 'Sentido', auto: 'Automático (sin revisar)', reviewed: 'Revisado por un sismólogo',
    names: { INPRES: 'INPRES (Instituto Nacional de Prevención Sísmica, Argentina)', CSN: 'Centro Sismológico Nacional de la Universidad de Chile' },
    note: 'Cada organismo calcula la magnitud con sus estaciones y su método, por eso puede diferir un poco de la del USGS.', see: 'Ver ficha',
  },
  en: {
    title: 'According to national agencies', mag: 'Magnitude', depth: 'Depth', felt: 'Felt', auto: 'Automatic (not reviewed)', reviewed: 'Reviewed by a seismologist',
    names: { INPRES: 'INPRES (National Institute for Seismic Prevention, Argentina)', CSN: 'National Seismological Center of the University of Chile' },
    note: 'Each agency computes magnitude with its own stations and method, so it can differ slightly from the USGS value.', see: 'See report',
  },
};

export function LocalAgencies({ lang, local, usgs }: { lang: Lang; local: LocalReport[]; usgs: boolean }) {
  if (!local.length) return null;
  const t = T[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  return (
    <section className="geo" aria-labelledby="local-h">
      <h2 id="local-h" className="ed-h3">{t.title}</h2>
      <ul className="ml-list">
        {local.map((l) => (
          <li key={l.agency + l.id}>
            <span className="ml-mag">{l.mag != null ? `M ${nf(l.mag, 1)}` : '—'}{l.magType ? ` ${l.magType}` : ''}</span>
            <span><b>{t.names[l.agency]}</b>{l.place ? ` · ${l.agency === 'CSN' ? csnPlace(l.place, lang) : l.place}` : ''}{l.depth != null ? ` · ${t.depth.toLowerCase()} ${nf(l.depth)} km` : ''}{l.felt ? ` · ${t.felt}` : ''}{l.reviewed != null ? ` · ${l.reviewed ? t.reviewed : t.auto}` : ''}</span>
            <a className="ml-act" href={l.url} target="_blank" rel="noopener noreferrer">{t.see} ↗</a>
          </li>
        ))}
      </ul>
      {usgs && <p className="ed-note">{t.note}</p>}
    </section>
  );
}
