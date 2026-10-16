import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Feature, Geometry } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { COL, SHAPE, fillFor, relevance, shapeD, sizeFor } from '@/lib/symbols';
import type { DisasterEvent } from '@/lib/types';

const topo = world as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
const LAND = feature(topo, topo.objects.land);
const BORDERS = mesh(topo, topo.objects.countries, (a, b) => a !== b);
const GRAT = geoGraticule10();

/** Globo SVG estático encuadrado en un país, con su contorno resaltado y sus eventos. */
export function CountryGlobe({ shapes, centroid, events, label, size = 520 }: {
  shapes: Feature<Geometry>[]; centroid: [number, number]; events: DisasterEvent[]; label: string; size?: number;
}) {
  const R0 = (size / 2) * 0.9;
  const proj = geoOrthographic().clipAngle(90).precision(0.5).rotate([-centroid[0], -centroid[1]]);
  const fc = { type: 'FeatureCollection' as const, features: shapes };
  proj.fitExtent([[size * 0.18, size * 0.18], [size * 0.82, size * 0.82]], fc);
  // Nunca más chico que el globo entero; tampoco un zoom que pixele el 1:110M.
  proj.scale(Math.min(Math.max(proj.scale(), R0), R0 * 9)).translate([size / 2, size / 2]);
  const path = geoPath(proj);
  const k = proj.scale() / R0;
  const ordered = events.slice().sort((a, b) => relevance(a) - relevance(b));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <clipPath id="globe-clip"><path d={path({ type: 'Sphere' }) ?? ''} /></clipPath>
      </defs>
      <path d={path({ type: 'Sphere' }) ?? ''} fill={COL.bg} />
      <g clipPath="url(#globe-clip)">
        <path d={path(GRAT) ?? ''} fill="none" stroke={COL.n200} strokeWidth={0.6} />
        <path d={path(LAND) ?? ''} fill={COL.n200} />
        <path d={path(fc) ?? ''} fill={COL.a300} fillOpacity={0.45} stroke={COL.a700} strokeWidth={1} />
        <path d={path(BORDERS) ?? ''} fill="none" stroke={COL.n400} strokeWidth={0.5} />
        {ordered.map((e) => {
          const p = proj([e.lon, e.lat]);
          if (!p || !path({ type: 'Point', coordinates: [e.lon, e.lat] })) return null;
          const st = fillFor(e);
          const sh = SHAPE[e.type];
          const r = sizeFor(e, Math.min(k, 4));
          return (
            <path key={e.id} d={shapeD(sh, p[0], p[1], r)} fill={sh === 'cross' ? 'none' : st.fill} stroke={st.stroke} strokeWidth={sh === 'cross' ? 1.4 : 0.8} />
          );
        })}
      </g>
      <path d={path({ type: 'Sphere' }) ?? ''} fill="none" stroke={COL.text} strokeOpacity={0.55} />
    </svg>
  );
}
