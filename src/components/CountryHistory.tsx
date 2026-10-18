import { geoDistance } from 'd3-geo';
import { T } from '@/lib/i18n';
import { fmtNum } from '@/lib/format';
import { getCountryHistory } from '@/lib/server/ncei';
import type { HistoricEvent, Lang } from '@/lib/types';

/*
 * Fase 2 · B: sismos y tsunamis significativos desde 1900 según NOAA NCEI (HazEL).
 * Un tsunami que NCEI registra junto con su sismo (mismo día ±1, <500 km) se muestra
 * en la fila del sismo, con su propio enlace; los demás tsunamis van en fila aparte.
 * Las cifras son las de NCEI; vacío = NCEI no informa el dato.
 */

const SHOWN = 15;
type Row = HistoricEvent & { tsu?: HistoricEvent };

const dayOf = (e: HistoricEvent) => Date.UTC(e.year, (e.month ?? 1) - 1, e.day ?? 1);
const sameEvent = (a: HistoricEvent, b: HistoricEvent) =>
  a.year === b.year && a.month != null && a.month === b.month && Math.abs(dayOf(a) - dayOf(b)) <= 864e5
  && geoDistance([a.lon, a.lat], [b.lon, b.lat]) * 6371 < 500;

function rows(events: HistoricEvent[]): Row[] {
  const eqs: Row[] = events.filter((e) => e.kind === 'eq').map((e) => ({ ...e }));
  const out: Row[] = [...eqs];
  for (const ts of events.filter((e) => e.kind === 'tsunami')) {
    const eq = eqs.find((e) => !e.tsu && sameEvent(e, ts));
    if (eq) eq.tsu = ts; else out.push(ts);
  }
  return out.sort((a, b) => dayOf(b) - dayOf(a));
}

export async function CountryHistory({ lang, iso3 }: { lang: Lang; iso3: string }) {
  const t = T[lang];
  const nf = (x: number | null, d = 0) => (x == null ? '' : fmtNum(lang, x, d));
  let events: HistoricEvent[];
  try {
    events = (await getCountryHistory(iso3)).events;
  } catch (err) {
    console.error('[pais] ncei', iso3, err);
    return null;
  }
  const list = rows(events);
  // Los más mortíferos (muertes según NCEI; a igualdad, mayor magnitud), en orden cronológico inverso.
  const top = list.slice()
    .sort((a, b) => Math.max(b.deaths ?? 0, b.tsu?.deaths ?? 0) - Math.max(a.deaths ?? 0, a.tsu?.deaths ?? 0) || (b.mag ?? 0) - (a.mag ?? 0))
    .slice(0, SHOWN).sort((a, b) => dayOf(b) - dayOf(a));
  const date = (e: HistoricEvent) =>
    e.month ? new Intl.DateTimeFormat(lang, { day: e.day ? 'numeric' : undefined, month: 'short', year: 'numeric', timeZone: 'UTC' }).format(dayOf(e)) : String(e.year);
  const tr = (e: Row) => (
    <tr key={e.id}>
      <td className="pos">{date(e)}</td>
      <th scope="row" className="hist-place">
        <a href={e.url} target="_blank" rel="noopener noreferrer">{e.location || '—'}</a>
        {e.tsu && <> · <a href={e.tsu.url} target="_blank" rel="noopener noreferrer" className="hist-tsu">{t.historyKind.tsunami}</a></>}
      </th>
      <td>{e.kind === 'tsunami' ? t.historyKind.tsunami : t.historyKind.eq}</td>
      <td>{nf(e.mag, 1)}</td>
      <td className={(e.deaths ?? 0) >= 100 ? 'red' : ''}>{nf(e.deaths)}</td>
      <td>{nf(e.damageMillionsUsd, e.damageMillionsUsd != null && e.damageMillionsUsd < 10 ? 1 : 0)}</td>
      <td>{nf(e.housesDestroyed)}</td>
    </tr>
  );
  const head = (
    <thead>
      <tr>
        <th scope="col">{t.historyCols.date}</th><th scope="col">{t.historyCols.place}</th><th scope="col">{t.historyCols.kind}</th>
        <th scope="col">{t.historyCols.mag}</th><th scope="col">{t.historyCols.deaths}</th>
        <th scope="col">{t.historyCols.damage}</th><th scope="col">{t.historyCols.houses}</th>
      </tr>
    </thead>
  );

  return (
    <section aria-labelledby="hist" className="hist">
      <h2 id="hist" className="ed-h3">{t.historyTitle}</h2>
      {list.length === 0 ? <p className="ed-note">{t.historyNone}</p> : (
        <>
          {list.length > SHOWN && <p className="ed-note">{t.historyTop(SHOWN)}</p>}
          <div className="ed-table-wrap">
            <table className="ed-table hist-table">
              {head}
              <tbody>{(list.length > SHOWN ? top : list).map(tr)}</tbody>
            </table>
          </div>
          {list.length > SHOWN && (
            <details className="hist-more">
              <summary>{t.historyMore(list.length)}</summary>
              <div className="ed-table-wrap">
                <table className="ed-table hist-table">
                  {head}
                  <tbody>{list.map(tr)}</tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
      <p className="ed-note">{t.historySource}</p>
    </section>
  );
}

/** Organismos oficiales nacionales (solo enlaces: sus datos no se mezclan con los del Mapa de Desastres). */
export const NATIONAL: Record<string, { name: string; url: string }[]> = {
  ARG: [{ name: 'INPRES · Instituto Nacional de Prevención Sísmica', url: 'https://www.inpres.gob.ar/' }],
  CHL: [{ name: 'CSN · Centro Sismológico Nacional (U. de Chile)', url: 'https://www.sismologia.cl/' }],
  MEX: [{ name: 'SSN · Servicio Sismológico Nacional (UNAM)', url: 'https://www.ssn.unam.mx/' }],
  PER: [{ name: 'IGP · Instituto Geofísico del Perú', url: 'https://www.igp.gob.pe/' }],
  JPN: [{ name: 'JMA · Japan Meteorological Agency', url: 'https://www.jma.go.jp/jma/indexe.html' }],
  BRA: [{ name: 'INPE · Programa Queimadas', url: 'https://terrabrasilis.dpi.inpe.br/queimadas/portal/' }],
  COL: [{ name: 'SGC · Servicio Geológico Colombiano', url: 'https://www.sgc.gov.co/' }],
  ECU: [{ name: 'IG-EPN · Instituto Geofísico', url: 'https://www.igepn.edu.ec/' }],
  NZL: [{ name: 'GeoNet (GNS Science)', url: 'https://www.geonet.org.nz/' }],
  IDN: [{ name: 'BMKG · Badan Meteorologi, Klimatologi, dan Geofisika', url: 'https://www.bmkg.go.id/' }],
  ITA: [{ name: 'INGV · Istituto Nazionale di Geofisica e Vulcanologia', url: 'https://www.ingv.it/' }],
};

export function NationalSources({ lang, iso3 }: { lang: Lang; iso3: string }) {
  const list = NATIONAL[iso3];
  if (!list) return null;
  return (
    <section aria-labelledby="nat" className="stack">
      <h2 id="nat" className="ed-h3">{T[lang].nationalTitle}</h2>
      {list.map((s) => (
        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="ed-ext">{s.name} <span aria-hidden="true">↗</span></a>
      ))}
    </section>
  );
}
