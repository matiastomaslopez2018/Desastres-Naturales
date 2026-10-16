import 'server-only';
import { geoBounds, geoCentroid, geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { iso3FromNumeric } from '../countries';

type Country = { name: string; iso3?: string; f: Feature<Geometry>; b: [[number, number], [number, number]] };

let countries: Country[] | null = null;

function load(): Country[] {
  if (countries) return countries;
  const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
  countries = fc.features.map((f) => ({
    name: f.properties.name, iso3: iso3FromNumeric(f.id, f.properties.name), f, b: geoBounds(f) as Country['b'],
  }));
  return countries;
}

function inBox(b: Country['b'], lon: number, lat: number) {
  const [[x0, y0], [x1, y1]] = b;
  if (lat < y0 || lat > y1) return false;
  return x0 <= x1 ? lon >= x0 && lon <= x1 : lon >= x0 || lon <= x1; // cruza el antimeridiano
}

/** País por punto-en-polígono (Natural Earth 1:110M). Puntos en el mar → undefined. */
export function countryAt(lon: number, lat: number): { name: string; iso3?: string } | undefined {
  for (const c of load()) {
    if (inBox(c.b, lon, lat) && geoContains(c.f, [lon, lat])) return { name: c.name, iso3: c.iso3 };
  }
  return undefined;
}

/** Contorno(s) y centroide de un país para dibujarlo (puede haber varios polígonos con el mismo ISO). */
export function countryShape(iso3: string): { features: Feature<Geometry>[]; centroid: [number, number] } | null {
  const fs = load().filter((c) => c.iso3 === iso3).map((c) => c.f);
  if (!fs.length) return null;
  // El centroide del polígono más grande evita que territorios lejanos lo desplacen.
  const main = fs.reduce((a, b) => (JSON.stringify(b.geometry).length > JSON.stringify(a.geometry).length ? b : a));
  return { features: fs, centroid: geoCentroid(main) as [number, number] };
}

/**
 * Completa país e ISO-3 del evento: punto-en-polígono primero; si cae en el
 * mar, se respeta el país que informe la fuente (GDACS).
 */
export function withCountry<T extends { lon: number; lat: number; country?: string; iso3?: string }>(e: T): T {
  const hit = countryAt(e.lon, e.lat);
  if (hit) return { ...e, country: hit.name, iso3: hit.iso3 ?? e.iso3 };
  return e;
}
