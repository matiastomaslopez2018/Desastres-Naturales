import Link from 'next/link';
import { Glyph } from './Glyph';
import { WorldMap } from './WorldMap';
import { countryName } from '@/lib/countries';
import { localTitle } from '@/lib/localize';
import { fmtNum, fmtRel } from '@/lib/format';
import { T } from '@/lib/i18n';
import { SHAPE, isHighlighted, type FilterType } from '@/lib/symbols';
import type { DisasterEvent, EventsResponse, Lang } from '@/lib/types';

const TYPES: FilterType[] = ['volcano', 'fire', 'storm', 'flood', 'drought', 'tsunami'];

/**
 * 2b "Periodístico": el resumen de la semana debajo del globo, con titular
 * automático, mapa plano, los sismos más fuertes y conteos por tipo.
 */
export function WeeklySummary({ lang, data }: { lang: Lang; data: EventsResponse }) {
  const t = T[lang];
  const nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const quakes = data.events.filter((e) => e.type === 'eq' && e.mag != null).sort((a, b) => (b.mag ?? 0) - (a.mag ?? 0));
  const strongest = quakes[0];
  const activeOther = data.events.filter((e) => e.type !== 'eq' && e.src === 'NASA EONET' && !e.closed).length;

  const counts: Record<FilterType, number> = { eq: quakes.length, tsunami: 0, volcano: 0, fire: 0, storm: 0, flood: 0, drought: 0 };
  for (const e of data.events) {
    if (e.type === 'eq') { if (e.tsunami) counts.tsunami++; }
    else counts[e.type]++;
  }
  const maxType = Math.max(1, ...TYPES.map((k) => counts[k]));

  const where = (e: DisasterEvent) => {
    if (e.iso3) return countryName(e.iso3, lang);
    const t = localTitle(e, lang);
    return t.split(', ').pop() ?? t;
  };
  const labels = quakes.slice(0, 12).map((e) => ({ e, text: `M${nf(e.mag ?? 0, 1)} · ${where(e)}` }));

  const headline = quakes.length ? t.weekHeadline(nf(quakes.length), quakes.length === 1) : t.weekNoQuakes;
  const dek = (strongest ? t.weekDek(nf(strongest.mag ?? 0, 1), localTitle(strongest, lang)) : '') + (activeOther ? t.weekDekOther(nf(activeOther)) : '');

  return (
    <section id="semana" className="theme-paper week" aria-labelledby="week-title">
      <div className="week-head">
        <span className="ed-kicker">{t.weekKicker}</span>
        <h2 id="week-title" className="ed-headline">{headline}</h2>
        {dek && <p className="ed-dek">{dek}</p>}
      </div>

      <figure className="week-map">
        <WorldMap events={data.events} labels={labels} lang={lang} label={t.mapCaption} />
        <figcaption className="map-legend">
          <span className="legend-sizes" aria-hidden="true"><i style={{ width: 6, height: 6 }} /><i style={{ width: 12, height: 12 }} /><i style={{ width: 20, height: 20 }} /></span>
          <span>{t.legendMag}</span>
          <span className="legend-red" aria-hidden="true" />
          <span>{t.legendRed}</span>
          <span className="legend-src">{t.weekSources}</span>
        </figcaption>
      </figure>

      <div className="week-cols">
        <div>
          <h3 className="ed-h3">{t.strongest}</h3>
          {quakes.slice(0, 5).map((e) => (
            <Link key={e.id} href={`/${lang}/evento/${encodeURIComponent(e.id)}`} className="ed-list-row">
              <span className={`ed-list-mag${isHighlighted(e) ? ' red' : ''}`}>{nf(e.mag ?? 0, 1)}</span>
              <span className="ed-list-title">{localTitle(e, lang)}</span>
              <span className="ed-list-meta">{fmtRel(lang, e.time)}</span>
            </Link>
          ))}
        </div>
        <div>
          <h3 className="ed-h3">{t.byType}</h3>
          <div className="type-bars">
            {TYPES.map((k) => (
              <div key={k} className="type-bar">
                <div className="row-between">
                  <span className="row"><Glyph shape={SHAPE[k]} type={k} />{t.T[k]}</span>
                  <strong className="tabular">{nf(counts[k])}</strong>
                </div>
                <div className="bar"><div style={{ width: `${Math.round((counts[k] / maxType) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="ed-h3">{t.howToRead}</h3>
          <p className="ed-body">{t.howToReadText}</p>
          <p className="ed-links">
            <Link href={`/${lang}/metodologia`}>{t.readMethod}</Link>
            <Link href={`/${lang}/ranking`}>{t.seeRanking}</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
