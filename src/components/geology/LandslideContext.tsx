import { fmtNum, fmtTime } from '@/lib/format';
import { glcNear, lhasaAt, LHASA_VIEWER, usgsGroundFailure } from '@/lib/server/landslides';
import type { DisasterEvent, Lang } from '@/lib/types';

/*
 * Deslizamientos en la ficha de sismos, inundaciones y tormentas (Fase 3 · D):
 * producto Ground Failure de USGS (sismos), pronóstico inmediato LHASA de NASA (eventos
 * en curso) y deslizamientos con registro en el catálogo de NASA a 50 km o menos.
 */

const DAY = 864e5;
const short = (s: string) => (!s ? '—' : s.length > 90 ? `${s.slice(0, 88).trimEnd()}…` : s);
type Alert = 'green' | 'yellow' | 'orange' | 'red';

const TXT = {
  es: {
    h: 'Deslizamientos',
    gf: 'Deslizamientos y licuefacción provocados por el sismo (USGS)',
    alert: { green: 'verde', yellow: 'amarilla', orange: 'naranja', red: 'roja' } as Record<Alert, string>,
    slideAlert: (a: string) => `Alerta de deslizamientos: ${a}`, liqAlert: (a: string) => `Alerta de licuefacción: ${a}`,
    pop: (n: string) => `Población expuesta estimada: ${n} personas`,
    area: (n: string) => `Área con peligro estimada: ${n} km²`,
    gfNote: 'Estimación automática del producto Ground Failure de USGS a partir del ShakeMap: el mapa muestra la probabilidad de deslizamientos según el modelo de Nowicki Jessee et al. (2018). Es un modelo, no un relevamiento de lo ocurrido; el nivel de alerta usa la misma escala de colores que PAGER.',
    gfLink: 'Ver el análisis en USGS',
    lhasa: 'Pronóstico inmediato de NASA (LHASA)',
    lhasaVal: (p: string) => `Probabilidad de deslizamiento hoy en el punto del evento: ${p}.`,
    lhasaNote: 'Modelo LHASA de NASA: combina la lluvia de las últimas horas (GPM IMERG), la humedad del suelo (SMAP) y la susceptibilidad del terreno, a unos 1 km de resolución. Es la probabilidad en el punto informado por la fuente; la zona afectada puede ser más amplia. No reemplaza los avisos del país.',
    lhasaLink: 'Abrir el visor de deslizamientos de NASA',
    glc: 'Deslizamientos registrados en la zona',
    glcCount: (n: string, d: string) => `${n} deslizamientos registrados a 50 km o menos, ${d === '0' ? 'sin muertes informadas' : `con ${d} muertes informadas en total`}.`,
    glcNone: 'El catálogo de NASA no tiene deslizamientos registrados a 50 km o menos.',
    glcNote: 'Catálogo de deslizamientos de NASA (Global Landslide Catalog y otros inventarios de COOLR), armado a partir de noticias e informes, sobre todo de 2007 a 2024. Faltan muchos eventos.',
    deaths: (n: number) => (n === 1 ? '1 muerte' : `${n} muertes`), noDate: 'sin fecha',
  },
  en: {
    h: 'Landslides',
    gf: 'Landslides and liquefaction triggered by the earthquake (USGS)',
    alert: { green: 'green', yellow: 'yellow', orange: 'orange', red: 'red' } as Record<Alert, string>,
    slideAlert: (a: string) => `Landslide alert: ${a}`, liqAlert: (a: string) => `Liquefaction alert: ${a}`,
    pop: (n: string) => `Estimated population exposed: ${n} people`,
    area: (n: string) => `Estimated hazard area: ${n} km²`,
    gfNote: 'Automatic estimate from the USGS Ground Failure product, based on the ShakeMap: the map shows landslide probability according to the Nowicki Jessee et al. (2018) model. It is a model, not a survey of what happened; the alert level uses the same color scale as PAGER.',
    gfLink: 'See the analysis at USGS',
    lhasa: 'NASA landslide nowcast (LHASA)',
    lhasaVal: (p: string) => `Landslide probability today at the event location: ${p}.`,
    lhasaNote: 'NASA LHASA model: combines recent rainfall (GPM IMERG), soil moisture (SMAP) and terrain susceptibility, at about 1 km resolution. It is the probability at the point reported by the source; the affected area may be wider. It does not replace national warnings.',
    lhasaLink: 'Open the NASA landslide viewer',
    glc: 'Landslides recorded in the area',
    glcCount: (n: string, d: string) => `${n} landslides recorded within 50 km, ${d === '0' ? 'with no reported deaths' : `with ${d} reported deaths in total`}.`,
    glcNone: 'The NASA catalog has no landslides recorded within 50 km.',
    glcNote: 'NASA landslide catalog (Global Landslide Catalog and other COOLR inventories), compiled from news and reports, mostly 2007 to 2024. Many events are missing.',
    deaths: (n: number) => (n === 1 ? '1 death' : `${n} deaths`), noDate: 'no date',
  },
};

const blueMarble = (b: [number, number, number, number], w: number, h: number) =>
  `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_ShadedRelief_Bathymetry&CRS=EPSG:4326&BBOX=${b[1]},${b[0]},${b[3]},${b[2]}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/jpeg`;

export function wantsLandslides(e: DisasterEvent) {
  return (e.type === 'eq' && e.src === 'USGS' && (e.mag ?? 0) >= 5) || e.type === 'flood' || e.type === 'storm';
}

export async function LandslideContext({ lang, e }: { lang: Lang; e: DisasterEvent }) {
  const x = TXT[lang], nf = (n: number, d = 0) => fmtNum(lang, n, d);
  const active = Date.now() - (e.end ?? e.time) < 3 * DAY;
  const [gf, p, near] = await Promise.all([
    e.type === 'eq' ? usgsGroundFailure(e.id, Date.now() - e.time < 7 * DAY) : Promise.resolve(null),
    e.type !== 'eq' && active ? lhasaAt(e.lon, e.lat) : Promise.resolve(null),
    glcNear(e.lon, e.lat, 50),
  ]);
  if (!gf && p == null && near == null) return null;
  const dead = (near ?? []).reduce((s, r) => s + (r.deaths ?? 0), 0);
  const top = [...(near ?? [])].sort((a, b) => (b.deaths ?? 0) - (a.deaths ?? 0) || (b.time ?? 0) - (a.time ?? 0)).slice(0, 5);
  const w = 760, h = gf?.overlay ? Math.round((w * (gf.overlay.bbox[3] - gf.overlay.bbox[1])) / (gf.overlay.bbox[2] - gf.overlay.bbox[0])) : 0;

  return (
    <section className="geo" aria-labelledby="ls-h">
      <h2 id="ls-h" className="ed-h3">{x.h}</h2>
      {gf && (
        <div className="geo-block">
          <h3 className="geo-h">{x.gf}</h3>
          <ul className="ls-facts">
            {gf.landslideAlert && <li><span className={`ls-dot ls-${gf.landslideAlert}`} />{x.slideAlert(x.alert[gf.landslideAlert])}</li>}
            {gf.liquefactionAlert && <li><span className={`ls-dot ls-${gf.liquefactionAlert}`} />{x.liqAlert(x.alert[gf.liquefactionAlert])}</li>}
            {gf.landslidePop != null && <li>{x.pop(nf(gf.landslidePop))}</li>}
            {gf.landslideAreaKm2 != null && <li>{x.area(nf(gf.landslideAreaKm2))}</li>}
          </ul>
          {gf.overlay && h > 0 && h < 1600 && (
            <div className="hydro-map" style={{ aspectRatio: `${w} / ${h}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={blueMarble(gf.overlay.bbox, w, h)} alt="" loading="lazy" decoding="async" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gf.overlay.url} alt={x.gf} loading="lazy" decoding="async" className="hydro-over" />
            </div>
          )}
          <p className="ed-note">{x.gfNote} <a href={gf.url} target="_blank" rel="noopener noreferrer">{x.gfLink} ↗</a></p>
        </div>
      )}
      {p != null && (
        <div className="geo-block">
          <h3 className="geo-h">{x.lhasa}</h3>
          <p>{x.lhasaVal(`${nf(p * 100, p < 0.1 ? 1 : 0)} %`)}</p>
          <p className="ed-note">{x.lhasaNote} <a href={LHASA_VIEWER} target="_blank" rel="noopener noreferrer">{x.lhasaLink} ↗</a></p>
        </div>
      )}
      {near != null && (
        <div className="geo-block">
          <h3 className="geo-h">{x.glc}</h3>
          <p>{near.length ? x.glcCount(nf(near.length), nf(dead)) : x.glcNone}</p>
          {top.length > 0 && (
            <ul className="ls-list">
              {top.map((r) => (
                <li key={r.id}>
                  <strong>{r.time != null ? fmtTime(lang, r.time, 'UTC').split(' · ')[0] : x.noDate}</strong>
                  {' · '}{r.link ? <a href={r.link} target="_blank" rel="noopener noreferrer">{short(r.title)}</a> : short(r.title)}
                  {r.deaths ? ` · ${x.deaths(r.deaths)}` : ''}{` · ${nf(r.km)} km`}
                </li>
              ))}
            </ul>
          )}
          <p className="ed-note">{x.glcNote}</p>
        </div>
      )}
    </section>
  );
}
