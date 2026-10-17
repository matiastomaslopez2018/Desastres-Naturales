import { FireSpread } from './FireSpread';
import { fmtNum, fmtTime } from '@/lib/format';
import { compass } from '@/lib/geoText';
import { firms7, fwiForecast, nifcPerimeter, windForecast, type FwiLevel } from '@/lib/server/fireContext';
import type { DisasterEvent, Lang } from '@/lib/types';

const TXT = {
  es: {
    title: 'Contexto del incendio',
    fwi: 'Peligro meteorológico de incendio (FWI)', fwiToday: (l: string, v: string) => `Hoy: peligro ${l} (FWI ${v}).`,
    levels: { 'very-low': 'muy bajo', low: 'bajo', moderate: 'moderado', high: 'alto', 'very-high': 'muy alto', extreme: 'extremo' } as Record<FwiLevel, string>,
    fwiNote: 'El FWI (Fire Weather Index) estima qué tan favorable es el tiempo para que un incendio se propague, según temperatura, humedad, viento y lluvia. No dice si hay fuego ni cuánto combustible hay. Fuente: Copernicus GWIS (modelo ECMWF); clases de peligro de EFFIS.',
    fwiNone: 'GWIS no devolvió el índice para este punto.',
    wind: 'Viento: dirección probable de propagación', windNote: 'Viento a 10 m del modelo GFS de NOAA. La flecha apunta hacia donde sopla, que es la dirección probable de propagación según el viento. No es un pronóstico oficial del incendio: el relieve, el combustible y el combate cambian su avance.',
    windRun: (d: string) => `Corrida GFS de ${d}.`, windNone: 'No se pudo leer el pronóstico de viento de NOAA.',
    spread: 'Evolución: focos de calor de los últimos 7 días', spreadNote: 'Focos detectados por el satélite VIIRS (NASA FIRMS) a unos 40 km a la redonda. Un foco no siempre es este incendio: puede ser otra quema cercana.',
    spreadNoKey: 'Requiere la clave de NASA FIRMS.', spreadError: 'NASA FIRMS no respondió; se vuelve a intentar en unos minutos.',
    perimeter: 'Perímetro oficial (NIFC)', perimeterText: (n: string, a: string, c: string) => `${n}: ${a} acres${c}.`, contained: (p: string) => `, ${p} % contenido`,
    burned: 'Área quemada', burnedText: 'El área quemada estimada por satélite está en el visor de Copernicus GWIS.', burnedLink: "Abrir el visor de GWIS",
    smoke: 'Humo', smokeText: 'El pronóstico de humo y aerosoles lo publica Copernicus CAMS.', smokeLink: 'Ver pronóstico de aerosoles (CAMS)',
    labels: { day: 'Hasta el día', play: '▶ Reproducir', pause: '❚❚ Pausa', all: 'Todos los días', perimeter: 'Perímetro NIFC', empty: 'FIRMS no detectó focos en la zona en los últimos 7 días.', frp: 'FRP' },
    kmh: 'km/h',
  },
  en: {
    title: 'Wildfire context',
    fwi: 'Fire weather danger (FWI)', fwiToday: (l: string, v: string) => `Today: ${l} danger (FWI ${v}).`,
    levels: { 'very-low': 'very low', low: 'low', moderate: 'moderate', high: 'high', 'very-high': 'very high', extreme: 'extreme' } as Record<FwiLevel, string>,
    fwiNote: 'The FWI (Fire Weather Index) estimates how favorable the weather is for a fire to spread, from temperature, humidity, wind and rain. It does not say whether there is fire or how much fuel there is. Source: Copernicus GWIS (ECMWF model); EFFIS danger classes.',
    fwiNone: 'GWIS returned no index for this point.',
    wind: 'Wind: likely direction of spread', windNote: '10 m wind from the NOAA GFS model. The arrow points where the wind blows, the likely direction of spread according to the wind. This is not an official fire forecast: terrain, fuel and firefighting change how it advances.',
    windRun: (d: string) => `GFS run of ${d}.`, windNone: 'The NOAA wind forecast could not be read.',
    spread: 'Evolution: hotspots of the last 7 days', spreadNote: 'Hotspots detected by the VIIRS satellite (NASA FIRMS) within about 40 km. A hotspot is not always this fire: it may be another nearby burn.',
    spreadNoKey: 'Requires the NASA FIRMS key.', spreadError: 'NASA FIRMS did not respond; it will be retried in a few minutes.',
    perimeter: 'Official perimeter (NIFC)', perimeterText: (n: string, a: string, c: string) => `${n}: ${a} acres${c}.`, contained: (p: string) => `, ${p}% contained`,
    burned: 'Burned area', burnedText: 'Satellite-estimated burned area is in the Copernicus GWIS viewer.', burnedLink: "Open the GWIS viewer",
    smoke: 'Smoke', smokeText: 'Smoke and aerosol forecasts are published by Copernicus CAMS.', smokeLink: 'See aerosol forecast (CAMS)',
    labels: { day: 'Up to day', play: '▶ Play', pause: '❚❚ Pause', all: 'All days', perimeter: 'NIFC perimeter', empty: 'FIRMS detected no hotspots in the area in the last 7 days.', frp: 'FRP' },
    kmh: 'km/h',
  },
};

export async function FireContext({ lang, e }: { lang: Lang; e: DisasterEvent }) {
  const t = TXT[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const [fwi, wind, pts, perim] = await Promise.all([
    fwiForecast(e.lon, e.lat), windForecast(e.lon, e.lat), firms7(e.lon, e.lat),
    e.iso3 === 'USA' ? nifcPerimeter(e.lon, e.lat) : Promise.resolve(null),
  ]);
  const day = (d: string) => new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(Date.parse(d));
  return (
    <section className="geo" aria-labelledby="fire-ctx">
      <h2 id="fire-ctx" className="ed-h3">{t.title}</h2>

      <div className="geo-block">
        <h3 className="geo-h">{t.fwi}</h3>
        {fwi.length ? (<>
          <p className="geo-kind"><strong>{t.fwiToday(t.levels[fwi[0].level], nf(fwi[0].fwi, 1))}</strong></p>
          <div className="fwi-days">
            {fwi.map((d) => (
              <div key={d.date} className={`fwi-day fwi-${d.level}`}>
                <span className="fwi-date">{day(d.date)}</span><strong>{nf(d.fwi, 0)}</strong><span>{t.levels[d.level]}</span>
              </div>
            ))}
          </div>
        </>) : <p className="ed-note">{t.fwiNone}</p>}
        <p className="ed-note">{t.fwiNote}</p>
      </div>

      <div className="geo-block">
        <h3 className="geo-h">{t.wind}</h3>
        {wind?.steps.length ? (<>
          <div className="wind-steps">
            {wind.steps.map((s) => (
              <div key={s.time} className="wind-step">
                <svg viewBox="-20 -20 40 40" width="40" height="40" aria-hidden="true"><g transform={`rotate(${s.toDeg})`}><path d="M0 14V-12M-6 -5L0 -13 6 -5" className="wind-arrow" /></g></svg>
                <strong>{nf(s.speedKmh)} {t.kmh}</strong>
                <span className="ed-note">{compass(lang, s.toDeg)} · {fmtTime(lang, s.time, 'UTC').replace(/ \d{4}/, '')}</span>
              </div>
            ))}
          </div>
          <p className="ed-note">{t.windNote} {t.windRun(fmtTime(lang, wind.run, 'UTC'))} <a href="https://nomads.ncep.noaa.gov/" target="_blank" rel="noopener noreferrer">NOAA NOMADS ↗</a></p>
        </>) : <p className="ed-note">{t.windNone}</p>}
      </div>

      <div className="geo-block">
        <h3 className="geo-h">{t.spread}</h3>
        {Array.isArray(pts) ? <FireSpread points={pts} center={[e.lon, e.lat]} perimeter={perim?.geometry ?? null} labels={t.labels} lang={lang} /> : <p className="ed-note">{pts === 'nokey' ? t.spreadNoKey : t.spreadError}</p>}
        <p className="ed-note">{t.spreadNote}</p>
      </div>

      {perim && (
        <div className="geo-block">
          <h3 className="geo-h">{t.perimeter}</h3>
          <p>{t.perimeterText(perim.name, perim.acres != null ? nf(perim.acres) : '—', perim.contained != null ? t.contained(nf(perim.contained)) : '')}
            {perim.updated ? <span className="ed-note"> · {fmtTime(lang, perim.updated, 'UTC')}</span> : null}{' '}
            <a href={perim.url} target="_blank" rel="noopener noreferrer">NIFC ↗</a></p>
        </div>
      )}

      <div className="geo-block">
        <h3 className="geo-h">{t.burned} · {t.smoke}</h3>
        <p>{t.burnedText} <a href={`https://gwis.jrc.ec.europa.eu/apps/gwis_current_situation/`} target="_blank" rel="noopener noreferrer">{t.burnedLink} ↗</a></p>
        <p>{t.smokeText} <a href="https://atmosphere.copernicus.eu/charts/packages/cams/" target="_blank" rel="noopener noreferrer">{t.smokeLink} ↗</a></p>
      </div>
    </section>
  );
}
