import 'server-only';
import { geoBounds } from 'd3-geo';
import { fetchJson } from './cache';
import { kvCached } from './kvCache';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import { countryAt, countryShape } from './countries';
import type { HistoricEvent } from '../types';

/*
 * NOAA NCEI Natural Hazards (HazEL): bases históricas públicas de sismos y tsunamis
 * significativos (desde la antigüedad), con víctimas, heridos, daños y viviendas
 * destruidas según NCEI. Resuelve "víctimas y daños históricos" sin la licencia de EM-DAT.
 * Un sismo es "significativo" para NCEI si cumple al menos uno: muertes, daños ≥ US$1 M
 * (aprox.), magnitud ≥ 7,5, intensidad ≥ X o si generó un tsunami.
 */

countries.registerLocale(en);

const API = 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1';

/** Nombres de país de NCEI que no coinciden con el nombre ISO en inglés. */
const NCEI_ALIAS: Record<string, string> = {
  USA: 'USA', 'USA TERRITORY': 'USA', RUSSIA: 'RUS', 'UNITED KINGDOM': 'GBR', IRAN: 'IRN', 'SOUTH KOREA': 'KOR', 'NORTH KOREA': 'PRK',
  TAIWAN: 'TWN', VIETNAM: 'VNM', 'PAPUA NEW GUINEA': 'PNG', 'SOLOMON ISLANDS': 'SLB', VENEZUELA: 'VEN', BOLIVIA: 'BOL', SYRIA: 'SYR',
};

type EqItem = {
  id: number; year: number; month?: number; day?: number; locationName?: string; latitude?: number; longitude?: number;
  eqMagnitude?: number; deathsTotal?: number; deaths?: number; injuriesTotal?: number; injuries?: number;
  damageMillionsDollarsTotal?: number; damageMillionsDollars?: number; housesDestroyedTotal?: number; housesDestroyed?: number;
};
type TsItem = EqItem & { maxWaterHeight?: number };

const n = (...v: (number | undefined)[]) => v.find((x) => x != null) ?? null;

function mapEq(i: EqItem, kind: 'eq' | 'tsunami'): HistoricEvent | null {
  if (i.latitude == null || i.longitude == null) return null;
  return {
    id: `ncei-${kind}-${i.id}`, kind, year: i.year, month: i.month ?? null, day: i.day ?? null,
    location: (i.locationName ?? '').replace(/\s+/g, ' ').trim(), lat: i.latitude, lon: i.longitude,
    mag: i.eqMagnitude ?? null,
    deaths: n(i.deathsTotal, i.deaths), injuries: n(i.injuriesTotal, i.injuries),
    damageMillionsUsd: n(i.damageMillionsDollarsTotal, i.damageMillionsDollars),
    housesDestroyed: n(i.housesDestroyedTotal, i.housesDestroyed),
    maxWaterHeight: kind === 'tsunami' ? ((i as TsItem).maxWaterHeight ?? null) : undefined,
    url: kind === 'eq'
      ? `https://www.ngdc.noaa.gov/hazel/view/hazards/earthquake/event-more-info/${i.id}`
      : `https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/${i.id}`,
  };
}

async function query(kind: 'eq' | 'tsunami', params: Record<string, string | number>) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const path = kind === 'eq' ? 'earthquakes' : 'tsunamis/events';
  const out: HistoricEvent[] = [];
  // La API pagina de a 200 ítems.
  for (let page = 1; page <= 20; page++) {
    qs.set('page', String(page));
    const j = await fetchJson<{ items?: EqItem[]; totalPages?: number }>(`${API}/${path}?${qs}`, 30000);
    for (const i of j.items ?? []) { const m = mapEq(i, kind); if (m) out.push(m); }
    if (!j.totalPages || page >= j.totalPages) break;
  }
  return out;
}

/** Sismos y tsunamis significativos de un país desde `minYear`, por posición (no por nombre). */
export async function getCountryHistory(iso3: string, minYear = 1900) {
  const shape = countryShape(iso3);
  if (!shape) return { events: [] as HistoricEvent[], fetchedAt: Date.now() };
  const r = await kvCached(`ncei:country:${iso3}:${minYear}`, 7 * 24 * 36e5, async () => {
    const [[x0, y0], [x1, y1]] = geoBounds({ type: 'FeatureCollection', features: shape.features });
    // Margen de 1° para sismos costeros; después se filtra por país (o mar cercano).
    const box = { minLatitude: Math.max(-90, y0 - 1), maxLatitude: Math.min(90, y1 + 1), minLongitude: Math.max(-180, x0 - 1), maxLongitude: Math.min(180, x1 + 1), minYear };
    const wraps = x0 > x1; // país que cruza el antimeridiano: se consulta todo el rango de longitudes
    const params = wraps ? { ...box, minLongitude: -180, maxLongitude: 180 } : box;
    const [eqs, ts] = await Promise.all([query('eq', params), query('tsunami', params)]);
    // En tierra: país por posición. En el mar: el país que NCEI pone al inicio de
    // locationName ("CHILE:  MAULE…"), si coincide con el nombre en inglés del país.
    const enName = (countries.getName(iso3, 'en') ?? '').toUpperCase();
    return [...eqs, ...ts].filter((e) => {
      const c = countryAt(e.lon, e.lat);
      if (c) return c.iso3 === iso3;
      const head = e.location.split(':')[0].trim().toUpperCase();
      return !!enName && (head === enName || NCEI_ALIAS[head] === iso3);
    });
  });
  return { events: r.value.sort((a, b) => b.year - a.year || (b.month ?? 0) - (a.month ?? 0)), fetchedAt: r.at };
}

/** Sismos significativos a menos de `radiusKm` de un punto (para comparar con un sismo actual). */
export async function getNearbyHistory(lat: number, lon: number, radiusDeg = 3, minYear = 1900) {
  const key = `ncei:near:${lat.toFixed(1)}:${lon.toFixed(1)}:${radiusDeg}:${minYear}`;
  const r = await kvCached(key, 7 * 24 * 36e5, () => query('eq', {
    minLatitude: Math.max(-90, lat - radiusDeg), maxLatitude: Math.min(90, lat + radiusDeg),
    minLongitude: Math.max(-180, lon - radiusDeg), maxLongitude: Math.min(180, lon + radiusDeg), minYear,
  }));
  return { events: r.value, fetchedAt: r.at };
}

/** Tsunamis significativos a menos de `radiusDeg` de un punto (NCEI), con altura máxima de ola. */
export async function getNearbyTsunamis(lat: number, lon: number, radiusDeg = 3, minYear = 1900) {
  const key = `ncei:tsu:${lat.toFixed(1)}:${lon.toFixed(1)}:${radiusDeg}:${minYear}`;
  const r = await kvCached(key, 7 * 24 * 36e5, () => query('tsunami', {
    minLatitude: Math.max(-90, lat - radiusDeg), maxLatitude: Math.min(90, lat + radiusDeg),
    minLongitude: Math.max(-180, lon - radiusDeg), maxLongitude: Math.min(180, lon + radiusDeg), minYear,
  }));
  return { events: r.value, fetchedAt: r.at };
}
