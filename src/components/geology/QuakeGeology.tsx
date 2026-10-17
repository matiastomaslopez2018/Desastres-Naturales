import { Beachball } from './Beachball';
import { CrossSection } from './CrossSection';
import { FaultDiagram } from './FaultDiagram';
import { GEO, OAF_WINDOW, compass, plateLabel } from '@/lib/geoText';
import { fmtNum, fmtTime } from '@/lib/format';
import { quakeGeology } from '@/lib/server/geology';
import { translateParagraphs } from '@/lib/server/translate';
import type { DisasterEvent, Lang } from '@/lib/types';

/** Sección "Contexto geológico" de la ficha de un sismo (servidor; se transmite con Suspense). */
export async function QuakeGeology({ lang, e }: { lang: Lang; e: DisasterEvent }) {
  const geo = await quakeGeology(e).catch((err) => { console.error('[geology]', err); return null; });
  if (!geo) return null;
  const g = GEO[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const translated = lang === 'es' && geo.summary ? await translateParagraphs(`usgs-summary:${e.id}`, geo.summary) : null;
  const { mechanism: m, plates: p, slab, section, aftershocks: oaf } = geo;
  const kind = m ? g.kind[m.kind] : null;
  const fcst = oaf?.forecast ?? [];
  const mags = fcst[0]?.bins.map((b) => b.mag) ?? [];

  return (
    <section className="geo" aria-labelledby="geo-title">
      <h2 id="geo-title" className="ed-h3">{g.title}</h2>

      <div className="geo-block">
        <h3 className="geo-h">{g.mech}</h3>
        {m && kind ? (
          <div className="geo-mech">
            <Beachball strike={m.np1.strike} dip={m.np1.dip} rake={m.np1.rake} label={`${kind.name} · ${g.planes}`} />
            <FaultDiagram kind={m.kind} label={kind.name} />
            <div className="stack-2">
              <p className="geo-kind"><strong>{kind.name}</strong> <span className="geo-tag">{g.interp}</span></p>
              <p>{kind.text}</p>
              <p className="ed-note">
                {g.planes}: {g.plane(1)} {nf(m.np1.strike)}° / {nf(m.np1.dip)}° / {nf(m.np1.rake)}°
                {m.np2 && <> · {g.plane(2)} {nf(m.np2.strike)}° / {nf(m.np2.dip)}° / {nf(m.np2.rake)}°</>}
                {' · '}{g.source}: <a href={m.url} target="_blank" rel="noopener noreferrer">USGS {m.magType ? `(${m.magType})` : ''} ↗</a>
              </p>
            </div>
          </div>
        ) : <p className="ed-note">{g.noMech}</p>}
      </div>

      <div className="geo-block">
        <h3 className="geo-h">{g.plates}</h3>
        {p.here && <p>{g.epicenterIn} <strong>{plateLabel(lang, p.here.code, p.here.name)}</strong>.</p>}
        {p.boundary && p.other && (
          <p>{g.boundaryNear(`${p.boundary.subduction ? `${g.subduction}, ` : ''}${g.boundary[p.boundary.kind]} ${lang === 'es' ? 'con la' : 'with the'} ${plateLabel(lang, p.other.code, p.other.name)}`, nf(p.boundary.distKm))}.</p>
        )}
        {p.velocity && p.other && p.here && (
          <p>{g.velocity(plateLabel(lang, p.other.code, p.other.name), plateLabel(lang, p.here.code, p.here.name), nf(p.velocity.mmYr / 10, 1), compass(lang, p.velocity.azimuth), nf(p.velocity.azimuth))}</p>
        )}
        <p className="ed-note">PB2002 (Bird, 2003) · {g.velocityNote}</p>
      </div>

      <div className="geo-block">
        <h3 className="geo-h">{g.slab}</h3>
        {slab ? (
          <>
            <p>{g.slabDepth(nf(slab.depth), slab.region)} {e.depth != null && g.slabEq(nf(e.depth, 0))}</p>
            <p className="geo-kind"><strong>{g.relation[slab.relation].name}</strong> <span className="geo-tag">{g.interp}</span> — {g.relation[slab.relation].text}</p>
            <p className="ed-note">{g.slabCriteria}</p>
          </>
        ) : <p className="ed-note">{g.noSlab}</p>}
      </div>

      {section && <div className="geo-block"><h3 className="geo-h">{g.section}</h3><CrossSection lang={lang} s={section} /></div>}

      {geo.summary && (
        <div className="geo-block">
          <h3 className="geo-h">{g.summary}</h3>
          {translated ? (
            <>
              {translated.map((t) => <p key={t}>{t}</p>)}
              <p className="ed-note">{g.summaryAuto}</p>
              <details className="geo-orig"><summary>{g.summaryOriginal}</summary>{geo.summary.map((t) => <p key={t} lang="en">{t}</p>)}</details>
            </>
          ) : (
            <>
              {geo.summary.map((t) => <p key={t} lang="en">{t}</p>)}
              {lang === 'es' && (
                <p className="ed-note">{g.summaryOriginal} · <a href={`https://translate.google.com/translate?sl=en&tl=es&u=${encodeURIComponent(geo.url)}`} target="_blank" rel="noopener noreferrer">{g.summaryTranslate} ↗</a></p>
              )}
            </>
          )}
          <p className="ed-note">{g.source}: <a href={geo.url} target="_blank" rel="noopener noreferrer">USGS ↗</a></p>
        </div>
      )}

      {oaf && fcst.length > 0 && (
        <div className="geo-block">
          <h3 className="geo-h">{g.oaf}</h3>
          <div className="ed-table-wrap">
            <table className="ed-table geo-oaf">
              <thead><tr><th scope="col">{g.oafWindow}</th>{mags.map((mg) => <th key={mg} scope="col">{g.oafMag(nf(mg))}</th>)}</tr></thead>
              <tbody>
                {fcst.map((f) => (
                  <tr key={f.label}>
                    <th scope="row">{OAF_WINDOW[lang][f.label] ?? f.label}</th>
                    {f.bins.map((b) => (
                      <td key={b.mag} className={b.prob >= 0.5 ? 'red' : ''}>
                        {b.prob >= 0.995 ? '>99' : b.prob < 0.01 && b.prob > 0 ? '<1' : nf(b.prob * 100)} %
                        <span className="geo-range">{g.oafRange(nf(b.lo), nf(b.hi))}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ed-note">{g.oafIssued(fmtTime(lang, oaf.created, 'UTC'))} {g.oafNote} {g.oafModel}: {oaf.model} · <a href={oaf.url} target="_blank" rel="noopener noreferrer">USGS ↗</a></p>
        </div>
      )}

      <div className="geo-block">
        <h3 className="geo-h">{g.history}</h3>
        {geo.history.length ? (
          <ul className="geo-hist">
            {geo.history.map((h) => (
              <li key={h.id}>
                <a href={h.url} target="_blank" rel="noopener noreferrer">{h.year}</a> · {h.location}{h.mag != null ? ` · M ${nf(h.mag, 1)}` : ''}
                {h.deaths ? <strong> · {nf(h.deaths)} {h.deaths === 1 ? g.death : g.deaths}</strong> : ''}
              </li>
            ))}
          </ul>
        ) : <p className="ed-note">{g.historyNone}</p>}
        <p className="ed-note">{g.historyNote}</p>
      </div>
    </section>
  );
}
