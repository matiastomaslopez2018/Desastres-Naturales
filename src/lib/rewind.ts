import { geoArea } from 'd3-geo';

/*
 * d3-geo dibuja en la esfera: un polígono con el anillo en el sentido "equivocado" se
 * interpreta como todo el planeta menos ese polígono. Las fuentes (ArcGIS, GDACS) usan el
 * sentido de RFC 7946, al revés. Si un polígono ocupa más de media esfera, se invierte.
 */
export function rewind<G extends GeoJSON.Geometry | null | undefined>(g: G): G {
  if (!g) return g;
  const fix = (poly: number[][][]) => {
    const area = geoArea({ type: 'Polygon', coordinates: poly } as GeoJSON.Polygon);
    return area > 2 * Math.PI ? poly.map((ring) => ring.slice().reverse()) : poly;
  };
  if (g.type === 'Polygon') return { ...g, coordinates: fix(g.coordinates as number[][][]) } as G;
  if (g.type === 'MultiPolygon') return { ...g, coordinates: (g.coordinates as number[][][][]).map(fix) } as G;
  return g;
}
