/**
 * Deslizamientos con víctimas del catálogo de NASA (GLC y otros inventarios de COOLR) para la
 * capa del mapa. Se consulta el servicio ArcGIS de Earthdata GIS de a 2.000 registros.
 *   public/data/glc_fatal.json  [lon, lat, fecha ms|null, muertes, disparador, título, enlace, país][]
 *
 *   npm run glc
 */
import { writeFileSync } from 'node:fs';

const URL0 = 'https://gis.earthdata.nasa.gov/portal/rest/services/Landslides/COOLR_Reports_Points/FeatureServer/0/query';
type A = Record<string, string | number | null>;
const rows: (string | number | null)[][] = [];
async function main() {
for (let off = 0; ; off += 2000) {
  const q = `${URL0}?where=fatality_count%3E0&outFields=objectid,event_title,event_date,fatality_count,landslide_trigger,source_link,country_name,latitude,longitude&orderByFields=objectid&resultOffset=${off}&resultRecordCount=2000&returnGeometry=false&f=json`;
  const j = (await (await fetch(q)).json()) as { features: { attributes: A }[]; exceededTransferLimit?: boolean };
  for (const { attributes: a } of j.features) {
    const lon = Number(a.longitude), lat = Number(a.latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    rows.push([Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000, a.event_date != null ? Number(a.event_date) : null, Number(a.fatality_count),
      a.landslide_trigger ? String(a.landslide_trigger).toLowerCase() : null, String(a.event_title ?? '').trim().slice(0, 120), (a.source_link as string) || null, (a.country_name as string) || null]);
  }
  if (!j.exceededTransferLimit && j.features.length < 2000) break;
}
writeFileSync('public/data/glc_fatal.json', JSON.stringify(rows));
console.log(`${rows.length} deslizamientos con víctimas`);
}
main();
