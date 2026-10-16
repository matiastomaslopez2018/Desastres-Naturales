import Link from 'next/link';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { PAPER, SHAPE, isHighlighted, paperStyle, relevance, shapeD, sizeFor } from '@/lib/symbols';
import type { DisasterEvent, Lang } from '@/lib/types';

const topo = world as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
const LAND = feature(topo, topo.objects.land);
const BORDERS = mesh(topo, topo.objects.countries, (a, b) => a !== b);

const W = 1280, H = 600;

/**
 * Mapa plano 2b (Equal Earth) para el resumen editorial. Usa el mismo código que el
 * globo nocturno —forma = tipo, tamaño = magnitud, destacado = M6+ o alerta oficial—
 * traducido a papel: tinta en vez de color y rojo en vez de anillo.
 */
export function WorldMap({ events, labels: candidates, lang, label, maxLabels = 3 }: {
  events: DisasterEvent[]; labels: { e: DisasterEvent; text: string }[]; lang: Lang; label: string; maxLabels?: number;
}) {
  const proj = geoEqualEarth().rotate([-10, 0]).fitExtent([[0, 10], [W, H - 30]], { type: 'Sphere' });
  const path = geoPath(proj);
  // Misma escala y mismas formas que el globo nocturno (sizeFor con zoom 1, SHAPE por tipo).
  const r = (e: DisasterEvent) => sizeFor(e, 1) * 0.9;
  const ordered = events.slice().sort((a, b) => relevance(a) - relevance(b));

  // Rótulos: los candidatos en orden, salteando los que quedarían encima de uno ya elegido.
  const MIN_PX = 150;
  const labels: { e: DisasterEvent; text: string }[] = [];
  const placed: [number, number][] = [];
  for (const c of candidates) {
    const p = proj([c.e.lon, c.e.lat]);
    if (!p || placed.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < MIN_PX)) continue;
    labels.push(c); placed.push(p as [number, number]);
    if (labels.length >= maxLabels) break;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="world-map">
      <path d={path({ type: 'Sphere' }) ?? ''} fill={PAPER.sphere} />
      <path d={path(LAND) ?? ''} fill={PAPER.land} />
      <path d={path(BORDERS) ?? ''} fill="none" stroke={PAPER.borders} strokeWidth={0.7} />
      {ordered.map((e) => {
        const p = proj([e.lon, e.lat]);
        if (!p) return null;
        const st = paperStyle(e);
        const sh = SHAPE[e.type];
        return (
          <path key={e.id} d={shapeD(sh, p[0], p[1], r(e))} fill={sh === 'cross' ? 'none' : st.fill} fillOpacity={st.fillOpacity}
            stroke={st.stroke} strokeOpacity={isHighlighted(e) ? 1 : 0.6} strokeWidth={sh === 'cross' ? 1.4 : 1} />
        );
      })}
      {labels.map(({ e, text }, i) => {
        const p = proj([e.lon, e.lat]);
        if (!p) return null;
        const [x, y] = p;
        const right = x > W * 0.75;
        const ty = Math.max(24, y - 44 - i * 10);
        const tx = right ? x - 12 : x + 12;
        return (
          <Link key={e.id} href={`/${lang}/evento/${encodeURIComponent(e.id)}`}>
            <path d={`M${x} ${y - r(e) - 2}V${ty + 5}H${tx}`} fill="none" stroke={PAPER.ink} strokeWidth={1} />
            <text x={right ? tx - 6 : tx + 6} y={ty + 9} textAnchor={right ? 'end' : 'start'} className="map-label">{text}</text>
          </Link>
        );
      })}
    </svg>
  );
}
