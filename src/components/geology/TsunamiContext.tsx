import { TSU } from '@/lib/geoText';
import { fmtNum, fmtTime } from '@/lib/format';
import { quakeGeology } from '@/lib/server/geology';
import { countryAt } from '@/lib/server/countries';
import { getTsunamiMessages, tsunamiFor } from '@/lib/server/tsunami';
import { tsunamiContext } from '@/lib/server/tsunamiContext';
import type { DisasterEvent, Lang } from '@/lib/types';

/** ¿Merece sección de tsunami? Sismos con indicador de USGS, o M6,5+ poco profundos. */
export const wantsTsunami = (e: DisasterEvent) =>
  e.type === 'eq' && e.src === 'USGS' && (!!e.tsunami || ((e.mag ?? 0) >= 6.5 && (e.depth ?? 0) <= 100));

export async function TsunamiContext({ lang, e }: { lang: Lang; e: DisasterEvent }) {
  const t = TSU[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const [ctx, geo, tsu] = await Promise.all([
    tsunamiContext(e).catch(() => null),
    quakeGeology(e).catch(() => null),
    getTsunamiMessages().catch(() => null),
  ]);
  const atSea = !countryAt(e.lon, e.lat);
  const checks: [keyof typeof t.checks, boolean | null][] = [
    ['sea', atSea],
    ['shallow', e.depth != null ? e.depth <= 70 : null],
    ['big', e.mag != null ? e.mag >= 7 : null],
    ['thrust', geo?.mechanism ? geo.mechanism.kind === 'reverse' : null],
  ];
  const maps = (tsu ? tsunamiFor(e, tsu.messages) : []).flatMap((m) => m.maps ?? []);

  return (
    <section className="geo" aria-labelledby="tsu-title">
      <h2 id="tsu-title" className="ed-h3">{t.title}</h2>
      <div className="geo-block">
        <h3 className="geo-h">{t.why}</h3>
        <ul className="tsu-checks">
          {checks.map(([k, ok]) => (
            <li key={k} className={ok == null ? 'unk' : ok ? 'yes' : 'no'}>
              <strong>{ok == null ? t.unknown : ok ? t.yes : t.no}</strong> · {t.checks[k][0]}
              <span className="ed-note"> — {t.checks[k][1]}</span>
            </li>
          ))}
        </ul>
        <p className="ed-note">{t.whyNote}</p>
      </div>

      {maps.length > 0 && (
        <div className="geo-block">
          <h3 className="geo-h">{t.maps}</h3>
          {maps.map((m) => (
            <figure key={m.url} className="media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.title} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto' }} />
              <figcaption className="media-credit">{m.title} · NOAA (NTWC/PTWC) · <a href={m.url} target="_blank" rel="noopener noreferrer">tsunami.gov ↗</a></figcaption>
            </figure>
          ))}
        </div>
      )}

      {ctx && ctx.buoys.length > 0 && (
        <div className="geo-block">
          <h3 className="geo-h">{t.buoys}</h3>
          <ul className="geo-hist">
            {ctx.buoys.map((b) => (
              <li key={b.id}>
                <a href={`https://www.ndbc.noaa.gov/station_page.php?station=${b.id}`} target="_blank" rel="noopener noreferrer">DART {b.id}</a> · {b.name} · {t.km(nf(b.km))} ·{' '}
                <span className={b.reporting ? 'tsu-on' : 'tsu-off'}>{b.reporting ? t.reporting : t.notReporting}</span>
                {b.last ? <span className="ed-note"> · {t.last(fmtTime(lang, b.last, 'UTC'))}</span> : null}
              </li>
            ))}
          </ul>
          <p className="ed-note">{t.buoysNote}</p>
        </div>
      )}

      {ctx && (
        <div className="geo-block">
          <h3 className="geo-h">{t.history}</h3>
          {ctx.history.length ? (
            <ul className="geo-hist">
              {ctx.history.map((h) => (
                <li key={h.id}>
                  <a href={h.url} target="_blank" rel="noopener noreferrer">{h.year}</a> · {h.location}
                  {h.maxWaterHeight != null ? <strong> · {t.wave(nf(h.maxWaterHeight, 1))}</strong> : ''}
                  {h.deaths ? ` · ${t.deaths(nf(h.deaths))}` : ''}
                </li>
              ))}
            </ul>
          ) : <p className="ed-note">{t.historyNone}</p>}
          <p className="ed-note">{t.historyNote}</p>
        </div>
      )}
    </section>
  );
}
