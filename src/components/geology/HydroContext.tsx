import { fmtTime } from '@/lib/format';
import { emsActivationFor, gdoDrought, gdoMap, imergLegend, type DroughtLevel } from '@/lib/server/hydro';
import type { DisasterEvent, Lang } from '@/lib/types';

/*
 * Fichas de inundación y sequía (Fase 3 · D). Los mapas son imágenes de los servicios
 * oficiales (GloFAS, NASA GIBS, Copernicus GDO, US Drought Monitor) sobre el relieve
 * Blue Marble de NASA; cada uno con su fuente, fecha y leyenda.
 */

const DAY = 864e5;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
type Box = [number, number, number, number]; // oeste, sur, este, norte

const boxAround = (lon: number, lat: number, halfLat: number): Box => {
  const halfLon = Math.min(60, (halfLat * 2) / Math.max(0.3, Math.cos((lat * Math.PI) / 180)));
  return [Math.max(-180, lon - halfLon), Math.max(-90, lat - halfLat), Math.min(180, lon + halfLon), Math.min(90, lat + halfLat)];
};
/** WMS 1.3.0 en EPSG:4326 pide el recuadro como sur,oeste,norte,este. */
const bbox13 = (b: Box) => `${b[1]},${b[0]},${b[3]},${b[2]}`;
const W = 800, H = 400;
const blueMarble = (b: Box) =>
  `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_ShadedRelief_Bathymetry&CRS=EPSG:4326&BBOX=${bbox13(b)}&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/jpeg`;

function LayeredMap({ base, overlay, alt, pin }: { base: string; overlay: string; alt: string; pin?: boolean }) {
  return (
    <div className="hydro-map">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={base} alt="" width={W} height={H} loading="lazy" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={overlay} alt={alt} width={W} height={H} loading="lazy" decoding="async" className="hydro-over" />
      {pin && <span className="hydro-pin" aria-hidden="true" />}
    </div>
  );
}

const TXT = {
  es: {
    flood: 'Contexto de la inundación', drought: 'Contexto de la sequía',
    glofas: 'Pronóstico de caudales (GloFAS)',
    glofasNote: 'Resumen del pronóstico de crecidas para los próximos 3 días del sistema GloFAS (Copernicus EMS). Violeta: el caudal máximo pronosticado supera el de una crecida de 20 años; rojo, de 5 a 20 años; naranja, de 2 a 5 años; amarillo, más de 20 % de probabilidad de superar la de 2 años. Los triángulos son puntos de pronóstico (hacia arriba, el caudal sube). Escala continental: no reemplaza los avisos de los servicios hidrológicos nacionales.',
    rain: 'Lluvia estimada por satélite (IMERG)', rainNote: (d: string) => `Intensidad de lluvia del ${d} estimada por la misión GPM de NASA (IMERG), vía NASA GIBS. Escala oficial de GIBS:`, rainUnits: 'milímetros por hora',
    ems: 'Mapeo de emergencia (Copernicus EMS)', emsText: (c: string, n: string, a: string, p: string) => `Activación ${c}: “${n}”, con ${a} zonas analizadas y ${p} mapas publicados.`,
    emsNone: 'No hay una activación de Copernicus EMS Rapid Mapping asociada a este evento.', emsLink: 'Ver mapas de la activación',
    gdo: 'Riesgo de impacto de la sequía en la agricultura (Copernicus GDO)',
    level: { high: 'alto', medium: 'medio', low: 'bajo', none: 'sin riesgo señalado' } as Record<DroughtLevel, string>,
    gdoAt: (lv: string, d: string) => `En este punto: riesgo ${lv} (datos del ${d}).`,
    trend: (lv: string, d: string) => `Diez días antes (${d}): ${lv}.`,
    gdoNote: 'Indicador RDrI-Agri del Observatorio Global de Sequías (JRC, Copernicus EMS), actualizado cada 10 días. Combina la amenaza de sequía con la exposición y la vulnerabilidad de la agricultura. El nivel en el punto se lee del mapa oficial comparando su color con la leyenda.',
    gdoNone: 'El Observatorio Global de Sequías no tiene datos recientes para este punto.',
    usdm: 'US Drought Monitor', usdmNote: 'Mapa semanal oficial de sequía de Estados Unidos (National Drought Mitigation Center, USDA y NOAA) y cambio respecto de la semana anterior.',
    license: 'Copernicus EMS: uso libre con atribución. NASA: sin derechos de autor, uso libre con crédito.',
  },
  en: {
    flood: 'Flood context', drought: 'Drought context',
    glofas: 'River flow forecast (GloFAS)',
    glofasNote: 'GloFAS (Copernicus EMS) flood forecast summary for the next 3 days. Purple: forecast peak flow above a 20-year flood; red, 5 to 20 years; orange, 2 to 5 years; yellow, over 20% probability of exceeding the 2-year flood. Triangles are forecast points (pointing up, flow is rising). Continental scale: it does not replace national hydrological warnings.',
    rain: 'Satellite rainfall estimate (IMERG)', rainNote: (d: string) => `Rain rate on ${d} estimated by NASA’s GPM mission (IMERG), via NASA GIBS. Official GIBS scale:`, rainUnits: 'millimeters per hour',
    ems: 'Emergency mapping (Copernicus EMS)', emsText: (c: string, n: string, a: string, p: string) => `Activation ${c}: “${n}”, with ${a} areas analyzed and ${p} maps published.`,
    emsNone: 'No Copernicus EMS Rapid Mapping activation is linked to this event.', emsLink: 'See the activation maps',
    gdo: 'Risk of drought impact for agriculture (Copernicus GDO)',
    level: { high: 'high', medium: 'medium', low: 'low', none: 'no flagged risk' } as Record<DroughtLevel, string>,
    gdoAt: (lv: string, d: string) => `At this point: ${lv} risk (data of ${d}).`,
    trend: (lv: string, d: string) => `Ten days earlier (${d}): ${lv}.`,
    gdoNote: 'RDrI-Agri indicator from the Global Drought Observatory (JRC, Copernicus EMS), updated every 10 days. It combines drought hazard with the exposure and vulnerability of agriculture. The level at the point is read from the official map by matching its color to the legend.',
    gdoNone: 'The Global Drought Observatory has no recent data for this point.',
    usdm: 'US Drought Monitor', usdmNote: 'Official weekly US drought map (National Drought Mitigation Center, USDA and NOAA) and change from the previous week.',
    license: 'Copernicus EMS: free to use with attribution. NASA: not copyrighted, free to use with credit.',
  },
};

export async function FloodContext({ lang, e }: { lang: Lang; e: DisasterEvent }) {
  const t = TXT[lang];
  const b = boxAround(e.lon, e.lat, 3);
  const today = iso(Date.now());
  const rainDay = iso(Math.min(e.time, Date.now() - DAY));
  const glofas = `https://ows.globalfloods.eu/glofas-ows/ows.py?service=WMS&version=1.3.0&request=GetMap&layers=sumAL41EGE,MajorRivers1,reportingPoints&styles=&crs=EPSG:4326&bbox=${bbox13(b)}&width=${W}&height=${H}&format=image/png&transparent=true&time=${today}T00:00:00Z`;
  const imerg = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=IMERG_Precipitation_Rate&CRS=EPSG:4326&BBOX=${bbox13(b)}&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png&TRANSPARENT=true&TIME=${rainDay}`;
  const [ems, legend] = await Promise.all([emsActivationFor(e).catch(() => null), imergLegend()]);
  const day = (d: string) => fmtTime(lang, Date.parse(d), 'UTC').split(' · ')[0];
  return (
    <section className="geo" aria-labelledby="flood-ctx">
      <h2 id="flood-ctx" className="ed-h3">{t.flood}</h2>
      <div className="geo-block">
        <h3 className="geo-h">{t.glofas}</h3>
        <LayeredMap base={blueMarble(b)} overlay={glofas} alt={t.glofas} pin />
        <p className="ed-note">{t.glofasNote} {day(today)} · <a href="https://global-flood.emergency.copernicus.eu/" target="_blank" rel="noopener noreferrer">GloFAS ↗</a></p>
      </div>
      <div className="geo-block">
        <h3 className="geo-h">{t.rain}</h3>
        <LayeredMap base={blueMarble(b)} overlay={imerg} alt={t.rain} pin />
        <p className="ed-note">{t.rainNote(day(rainDay))}</p>
        {legend && (
          <div className="cbar" aria-label={`${t.rain} (${legend.units})`}>
            <span className="cbar-bar" style={{ background: `linear-gradient(to right, ${legend.colors.join(',')})` }} />
            <span className="cbar-ticks">{legend.ticks.map((k) => <span key={k.label} style={{ left: `${k.pos * 100}%` }}>{k.label}</span>)}</span>
            <span className="ed-note">{legend.units} · {t.rainUnits}</span>
          </div>
        )}
      </div>
      <div className="geo-block">
        <h3 className="geo-h">{t.ems}</h3>
        {ems ? <p>{t.emsText(ems.code, ems.name, String(ems.aois), String(ems.products))} <a href={ems.url} target="_blank" rel="noopener noreferrer">{t.emsLink} ↗</a></p> : <p className="ed-note">{t.emsNone}</p>}
      </div>
      <p className="ed-note">{t.license}</p>
    </section>
  );
}

export async function DroughtContext({ lang, e }: { lang: Lang; e: DisasterEvent }) {
  const t = TXT[lang];
  const b = boxAround(e.lon, e.lat, 8);
  const g = await gdoDrought(e.lon, e.lat);
  const day = (d: string) => fmtTime(lang, Date.parse(d), 'UTC').split(' · ')[0];
  const legend = 'https://drought.emergency.copernicus.eu/api/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=rdria&FORMAT=image/png';
  return (
    <section className="geo" aria-labelledby="drought-ctx">
      <h2 id="drought-ctx" className="ed-h3">{t.drought}</h2>
      <div className="geo-block">
        <h3 className="geo-h">{t.gdo}</h3>
        {g ? (<>
          <p className="geo-kind"><strong>{t.gdoAt(t.level[g.level], day(g.date))}</strong>{g.prevDate && g.prevLevel ? ` ${t.trend(t.level[g.prevLevel], day(g.prevDate))}` : ''}</p>
          <LayeredMap base={blueMarble(b)} overlay={gdoMap('rdria', b, W, H, g.date)} alt={t.gdo} pin />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={legend} alt="" className="hydro-legend small" loading="lazy" />
        </>) : <p className="ed-note">{t.gdoNone}</p>}
        <p className="ed-note">{t.gdoNote} <a href="https://drought.emergency.copernicus.eu/" target="_blank" rel="noopener noreferrer">GDO ↗</a></p>
      </div>
      {e.iso3 === 'USA' && (
        <div className="geo-block">
          <h3 className="geo-h">{t.usdm}</h3>
          <div className="usdm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://droughtmonitor.unl.edu/data/png/current/current_usdm.png" alt={t.usdm} loading="lazy" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://droughtmonitor.unl.edu/data/png/current/current_conus_trd.png" alt={t.usdm} loading="lazy" />
          </div>
          <p className="ed-note">{t.usdmNote} <a href="https://droughtmonitor.unl.edu/" target="_blank" rel="noopener noreferrer">droughtmonitor.unl.edu ↗</a></p>
        </div>
      )}
      <p className="ed-note">{t.license}</p>
    </section>
  );
}
