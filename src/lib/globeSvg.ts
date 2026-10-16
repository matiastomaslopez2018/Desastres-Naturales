import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';

const topo = world as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
const LAND = feature(topo, topo.objects.land);
const BORDERS = mesh(topo, topo.objects.countries, (a, b) => a !== b);
const GRAT = geoGraticule10();

/**
 * Trazados SVG de un globo ortográfico centrado en (lon, lat), para render
 * estático (ficha permalink sin JS, imagen OG). Mismo orden y estilo que el canvas.
 */
export function globePaths(lon: number, lat: number, size: number, plates?: unknown, track?: [number, number][] | null) {
  const R = (size / 2) * 0.9;
  const proj = geoOrthographic().clipAngle(90).precision(0.5).scale(R).translate([size / 2, size / 2]).rotate([-lon, -lat]);
  const path = geoPath(proj);
  const [x, y] = proj([lon, lat]) ?? [size / 2, size / 2];
  return {
    R, x, y,
    sphere: path({ type: 'Sphere' }) ?? '',
    grat: path(GRAT) ?? '',
    land: path(LAND) ?? '',
    borders: path(BORDERS) ?? '',
    plates: plates ? (path(plates as GeoJSON.FeatureCollection) ?? '') : '',
    track: track && track.length > 1 ? (path({ type: 'LineString', coordinates: track }) ?? '') : '',
  };
}
