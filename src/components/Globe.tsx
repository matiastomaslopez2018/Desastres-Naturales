'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { type GeoJSONSource, type LayerSpecification, type Map as MLMap, type MapGeoJSONFeature, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre 6 carga su worker desde un archivo aparte: Next lo publica con hash a partir de esta URL
// (receta oficial para webpack 5 / Next.js 15).
if (typeof window !== 'undefined') maplibregl.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());
import { mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';

import { RING, alertLevel } from '@/lib/symbols';
import { SMN_COLORS, SPC_COLORS, TYPE_COLOR, ssColor, type GlobeHandle, type Layers, type Overlays, type Pickable } from '@/lib/mapTypes';
import type { DisasterEvent, GvpVolcano, SourceStatus } from '@/lib/types';

/*
 * Globo 3D (MapLibre GL, proyección "globe"): imágenes NASA GIBS Blue Marble de lejos y
 * Sentinel-2 cloudless (EOX) de cerca, relieve AWS Terrain Tiles (Terrarium) con terreno 3D y
 * sombreado, y todas las capas de datos como capas nativas de MapLibre.
 */

export type { GlobeHandle } from '@/lib/mapTypes';

type Props = {
  events: DisasterEvent[];
  gvp: GvpVolcano[];
  overlays?: Overlays;
  layers: Layers;
  selected: Pickable | null;
  showTsunami: boolean;
  /** Terreno 3D (si es false, solo sombreado del relieve: modo liviano). */
  terrain: boolean;
  onSelect(e: Pickable): void;
  onHover(h: { e: Pickable; x: number; y: number } | null): void;
  onCarto(s: SourceStatus): void;
  /** Vista al quedar quieto el mapa: centro y "k" (2^(zoom − zoom inicial)), para pedir datos de la zona visible. */
  onView?(v: { lon: number; lat: number; k: number }): void;
  /** Cámara inclinada (vista de terreno) o no, para el texto de ayuda. */
  onPitch?(pitched: boolean): void;
  /** Cuadros por segundo bajos durante un movimiento: el Atlas pasa a modo liviano. */
  onLowFps?(fps: number): void;
  /** Estado de las capas ráster (amenaza GEM, FWI, LHASA). */
  onRaster?(id: 'hazard' | 'fwi' | 'lhasa' | 'smoke' | 'pm25', state: 'wait' | 'ok' | 'err'): void;
  /** Texto del indicador que aparece junto al evento mientras cargan las teselas del destino. */
  loadingText?: string;
  /**
   * Reproducción de la línea de tiempo: solo se muestran los eventos con inicio ≤ playHead (ms),
   * los ciclones hasta ese instante de su trayectoria y los focos FIRMS detectados hasta entonces.
   * flashSpan: cuánto tiempo de datos (ms) dura el destello de un evento que aparece (0 = sin destello).
   */
  playHead?: number | null;
  flashSpan?: number;
  /** Aviso cuando el navegador quita el contexto WebGL (por falta de memoria gráfica) y se reintenta. */
  lostText?: string;
};

/** Fuentes ráster (las que ocupan texturas en la GPU). */
const RASTER_SOURCES = new Set(['bm', 's2', 'dem', 'hazard', 'fwi', 'lhasa']);

/** Mapas vivos en la página (diagnóstico: tiene que ser 0 o 1; lo leen las pruebas en window.__mapasVivos). */
let mapsAlive = 0;
const countMaps = (d: number) => { mapsAlive += d; if (typeof window !== 'undefined') (window as unknown as { __mapasVivos: number }).__mapasVivos = mapsAlive; };

/* ───────────── Fondo y relieve ───────────── */

const INITIAL = { center: [-62, -8] as [number, number], zoom: 1.75, pitch: 0, bearing: 0 };
const isNarrow = () => typeof window !== 'undefined' && window.innerWidth < 600;
/**
 * Franja libre para el globo: entre el borde inferior de la barra superior y el borde superior de la
 * línea de tiempo (las dos flotan sobre el mapa), no el alto completo de la ventana.
 */
const freeBand = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  const stage = el.closest('.map-stage') ?? document;
  const topEl = stage.querySelector('.map-top'), botEl = stage.querySelector('.map-bottom');
  const top = topEl ? Math.max(0, topEl.getBoundingClientRect().bottom - r.top) : 0;
  const bottom = botEl ? Math.max(0, r.bottom - botEl.getBoundingClientRect().top) : 0;
  return { top, bottom, w: r.width, h: Math.max(1, r.height - top - bottom) };
};
/** Diámetro buscado: 92 % del lado menor de la franja libre. */
const FIT = 0.92;
/**
 * Primera estimación del zoom (antes de que exista el mapa). En la proyección de globo de MapLibre la
 * circunferencia mide 512·2^z px (diámetro 512·2^z/π); con la perspectiva se ve algo más chica, y eso
 * lo corrige la medición sobre el globo dibujado (fitGlobe).
 */
const fitZoom = (el: HTMLElement | null) => {
  if (!el || !el.clientWidth) return isNarrow() ? 1.1 : INITIAL.zoom;
  const b = freeBand(el);
  return Math.max(0.3, Math.min(3, Math.log2((1.2 * FIT * Math.min(b.w, b.h) * Math.PI) / 512)));
};
/**
 * Radio en pantalla de la esfera dibujada: se busca sobre una fila horizontal desde el centro el último
 * píxel cuyo punto geográfico vuelve al mismo píxel (fuera de la esfera, unproject se pega al horizonte).
 */
const globeRadius = (m: maplibregl.Map) => {
  const c = m.project(m.getCenter());
  const onGlobe = (r: number) => {
    const p = m.project(m.unproject([c.x + r, c.y]));
    return Math.abs(p.x - c.x - r) < 1 && Math.abs(p.y - c.y) < 1;
  };
  let lo = 0, hi = 4 * Math.max(m.getCanvas().clientWidth, m.getCanvas().clientHeight);
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (onGlobe(mid)) lo = mid; else hi = mid; }
  return lo;
};
/**
 * Zoom medido para que la esfera ocupe FIT del lado menor de la franja libre, centrada en ella
 * (padding arriba/abajo = barra superior / línea de tiempo). Corrige la estimación con el radio real
 * dibujado; dos pasadas bastan (la perspectiva cambia apenas con el zoom).
 */
const fitGlobe = (m: maplibregl.Map, el: HTMLElement) => {
  const b = freeBand(el);
  const padding = { top: Math.round(b.top), bottom: Math.round(b.bottom), left: 0, right: 0 };
  const target = (FIT * Math.min(b.w, b.h)) / 2;
  m.jumpTo({ center: INITIAL.center, pitch: 0, bearing: 0, padding });
  for (let i = 0; i < 2; i++) {
    const r = globeRadius(m);
    if (!r) break;
    m.jumpTo({ zoom: Math.max(0.3, Math.min(3, m.getZoom() + Math.log2(target / r))) });
  }
  return { zoom: m.getZoom(), padding };
};

/**
 * Celular (pantalla angosta, o táctil y de menos de 1024 px) y conexión lenta (3G o peor según
 * navigator.connection): vuelos un 30 % más lentos, relieve menos exagerado y teselas de
 * elevación hasta zoom 12 (13 en la compu).
 */
type Profile = { mobile: boolean; slow: boolean };
function deviceProfile(): Profile {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const mobile = isNarrow() || (coarse && window.innerWidth < 1024);
  const et = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? '';
  return { mobile, slow: /^(slow-2g|2g|3g)$/.test(et) };
}
const demMaxZoom = (p: Profile) => (p.mobile ? 12 : 13);
const exaggeration = (p: Profile) => (p.mobile || p.slow ? 1.1 : 1.4);

/**
 * Imágenes de cerca. Por defecto Sentinel-2 cloudless 2020 de EOX (CC BY-NC-SA 4.0: solo uso no
 * comercial). Para uso comercial, NEXT_PUBLIC_IMAGERY_URL (plantilla {z}/{x}/{y} de un proveedor
 * con licencia) y NEXT_PUBLIC_IMAGERY_ATTRIBUTION; o NEXT_PUBLIC_IMAGERY=gibs para quedarse solo
 * con NASA GIBS (dominio público, menos detalle).
 */
const IMAGERY = (() => {
  const url = process.env.NEXT_PUBLIC_IMAGERY_URL;
  if (url) return { tiles: [url], maxzoom: 18, attribution: process.env.NEXT_PUBLIC_IMAGERY_ATTRIBUTION ?? '' };
  if (process.env.NEXT_PUBLIC_IMAGERY === 'gibs') return null;
  return {
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
    maxzoom: 15,
    attribution: '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless 2020</a> © EOX IT Services GmbH (CC BY-NC-SA 4.0; datos Copernicus Sentinel modificados)',
  };
})();

/**
 * Desde este zoom se piden las teselas de elevación: de más lejos el relieve 3D no se distingue
 * (el Blue Marble ya trae relieve sombreado) y bajarlas cuesta ~1,5 MB en la primera carga.
 */
const TERRAIN_MIN_ZOOM = 4;
const DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const DEM = { type: 'raster-dem' as const, tiles: [DEM_URL], encoding: 'terrarium' as const, tileSize: 256, maxzoom: 13,
  attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a> (Mapzen, AWS Open Data)' };

/** Imágenes en Web Mercator (±85,05°) que se apoyan sobre el globo. */
const MERC: [[number, number], [number, number], [number, number], [number, number]] = [[-180, 85.0511], [180, 85.0511], [180, -85.0511], [-180, -85.0511]];
const RASTERS = {
  hazard: { url: '/data/gem-3857.png', opacity: 0.55, attribution: '© GEM Foundation, Global Seismic Hazard Map v2023.1 (CC BY-NC-SA 4.0)' },
  fwi: { url: '/api/fwi-map', opacity: 0.6, attribution: 'Copernicus GWIS · FWI (ECMWF)' },
  lhasa: { url: '/api/lhasa-map', opacity: 0.85, attribution: 'NASA LHASA' },
  smoke: { url: '/api/smoke-map', opacity: 0.8, attribution: 'Copernicus CAMS (ECMWF)' },
  pm25: { url: '/api/pm25-map', opacity: 0.6, attribution: 'Copernicus CAMS (ECMWF)' },
} as const;
type RasterId = keyof typeof RASTERS;

/* ───────────── Geometrías fijas ───────────── */

const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
const BORDERS = mesh(topo, topo.objects.countries, (a, b) => a !== b);


const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });
const pt = (lon: number, lat: number, properties: Record<string, unknown>): GeoJSON.Feature => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lon, lat] } });
/** Longitudes continuas (178 → 185 en vez de 178 → −175) para que la línea no dé la vuelta al mundo. */
const unwrap = (c: number[][]) => {
  const out: number[][] = [];
  for (const p of c) {
    const q = out[out.length - 1];
    let x = p[0];
    if (q) { while (x - q[0] > 180) x -= 360; while (x - q[0] < -180) x += 360; }
    out.push([x, ...p.slice(1)]);
  }
  return out;
};
const line = (coordinates: number[][], properties: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: unwrap(coordinates) } });
const multiline = (lines: number[][][], properties: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: 'Feature', properties, geometry: { type: 'MultiLineString', coordinates: lines.map(unwrap) } });
const EMPTY = fc([]);

/** Radio base del evento (px): en sismos según magnitud (2,5→2,5; 4,5→5; 6→9; 7,5→15), fijo en el resto. */
function baseRadius(e: DisasterEvent) {
  if (e.type !== 'eq') return e.type === 'fire' ? 4.5 : 6;
  const m = e.mag ?? 2.5, P: [number, number][] = [[2.5, 2.5], [4.5, 5], [6, 9], [7.5, 15]];
  if (m <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (m <= P[i][0]) return P[i - 1][1] + ((m - P[i - 1][0]) / (P[i][0] - P[i - 1][0])) * (P[i][1] - P[i - 1][1]);
  return P[3][1] + (m - 7.5) * 4;
}
/** Instante en que el evento aparece en la reproducción: su inicio (o su hora, si no informa inicio). */
const appearAt = (e: DisasterEvent) => e.start ?? e.time;
/** Anillo blanco: sismo M6+ o alerta oficial (PAGER/GDACS) distinta de verde. */
const hasRing = (e: DisasterEvent) => (e.type === 'eq' && (e.mag ?? 0) >= 6) || alertLevel(e) >= 1;
/** Zoom del vuelo según el tipo. */
const ZOOM_FOR: Record<string, number> = { eq: 7, volcano: 10.5, gvp: 10.5, wvolc: 10.5, fire: 9, heat: 9, smn: 5.5 };

/* ───────────── Íconos (dibujados con su color, a 2× para pantallas densas) ───────────── */

const ICONS: Record<string, { shape: 'tri' | 'diamond' | 'arrow' | 'head'; fill: string; stroke: string; sw: number; size: number }> = {
  'tri-volc': { shape: 'tri', fill: TYPE_COLOR.volcano, stroke: '#ffffff', sw: 3, size: 30 },
  'tri-gvp': { shape: 'tri', fill: '#ffffff', stroke: '#5a5a5a', sw: 2.5, size: 22 },
  'dia-dart': { shape: 'diamond', fill: TYPE_COLOR.tsunami, stroke: '#ffffff', sw: 2.5, size: 24 },
  'arrow-1': { shape: 'arrow', fill: '#1c7ed6', stroke: '#ffffff', sw: 2, size: 30 },
  'arrow-2': { shape: 'arrow', fill: '#f59f00', stroke: '#ffffff', sw: 2, size: 30 },
  'arrow-3': { shape: 'arrow', fill: '#e03131', stroke: '#ffffff', sw: 2, size: 30 },
  head: { shape: 'head', fill: '#ffffff', stroke: '#141414', sw: 1.5, size: 20 },
};

function makeIcon(name: string): ImageData | null {
  const d = ICONS[name];
  if (!d) return null;
  const S = d.size * 2, p = d.sw * 2, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.beginPath();
  if (d.shape === 'tri') { g.moveTo(S / 2, p); g.lineTo(S - p, S - p * 1.2); g.lineTo(p, S - p * 1.2); }
  else if (d.shape === 'diamond') { g.moveTo(S / 2, p); g.lineTo(S - p, S / 2); g.lineTo(S / 2, S - p); g.lineTo(p, S / 2); }
  else if (d.shape === 'arrow') { const w = S * 0.12; g.moveTo(S / 2, p); g.lineTo(S - p * 2.5, S * 0.42); g.lineTo(S / 2 + w, S * 0.38); g.lineTo(S / 2 + w, S - p); g.lineTo(S / 2 - w, S - p); g.lineTo(S / 2 - w, S * 0.38); g.lineTo(p * 2.5, S * 0.42); }
  else { g.moveTo(S / 2, p); g.lineTo(S - p, S - p); g.lineTo(S / 2, S * 0.7); g.lineTo(p, S - p); }
  g.closePath();
  g.lineJoin = 'round'; g.lineWidth = p; g.strokeStyle = d.stroke; g.stroke();
  g.fillStyle = d.fill; g.fill();
  return g.getImageData(0, 0, S, S);
}

/* ───────────── Estilo ───────────── */

const zoomScaled = (base: unknown, f = 1.8): unknown => ['interpolate', ['linear'], ['zoom'], 1, base, 8, ['*', f, base]];

/** Teselas (z, x, y) alrededor de un punto: 3 columnas y 4 filas, con más filas hacia el norte (lo que se ve al inclinar). */
function tilesAround(lon: number, lat: number, z: number) {
  const n = 2 ** z, x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180, y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  const out: [number, number, number][] = [];
  for (let dy = -2; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const yy = y + dy;
    if (yy >= 0 && yy < n) out.push([z, ((x + dx) % n + n) % n, yy]);
  }
  return out;
}
/** Precarga las teselas del destino (imágenes y elevación) mientras el mapa vuela: quedan en la caché del navegador. */
function prefetchTiles(lon: number, lat: number, zoom: number, p: Profile) {
  const urls: string[] = [];
  const fill = (tpl: string, [z, x, y]: [number, number, number]) => tpl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  if (IMAGERY && zoom >= 4.5) for (const t of tilesAround(lon, lat, Math.min(Math.round(zoom), IMAGERY.maxzoom))) urls.push(fill(IMAGERY.tiles[0], t));
  else for (const t of tilesAround(lon, lat, Math.min(Math.round(zoom), 8))) urls.push(fill('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg', t));
  if (zoom >= TERRAIN_MIN_ZOOM) for (const t of tilesAround(lon, lat, Math.min(Math.round(zoom), demMaxZoom(p)))) urls.push(fill(DEM_URL, t));
  for (const u of urls) fetch(u, { mode: 'cors', credentials: 'omit' }).catch(() => {});
}

function buildStyle(p: Profile): StyleSpecification {
  const geo = (id: string, extra: Record<string, unknown> = {}) => [id, { type: 'geojson', data: EMPTY, ...extra }] as const;
  const sources = Object.fromEntries([
    ['bm', { type: 'raster', tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'], tileSize: 256, maxzoom: 8,
      attribution: '<a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a> Blue Marble' }],
    ...(IMAGERY ? [['s2', { type: 'raster', tiles: IMAGERY.tiles, tileSize: 256, maxzoom: IMAGERY.maxzoom, attribution: IMAGERY.attribution }]] : []),
    ['dem', { ...DEM, maxzoom: demMaxZoom(p) }],
    geo('borders'), geo('ring'), geo('plates'), geo('slab'), geo('platevec'), geo('platehead'), geo('ibt-lines'), geo('ibt-pts'), geo('heat'),
    geo('storm-areas'), geo('storm-lines'), geo('storm-pts'), geo('ev-tracks'), geo('glc'), geo('gvp'), geo('wvolc'), geo('dart'),
    geo('spc-areas'), geo('nws'), geo('smn'), geo('spc-pts'), geo('wind'),
    geo('ev'), geo('evc', { cluster: true, clusterRadius: 38, clusterMaxZoom: 6 }), geo('sel'),
  ]) as StyleSpecification['sources'];

  const vis = (on = false) => ({ visibility: on ? 'visible' : 'none' } as const);
  const L: Record<string, unknown>[] = [
    { id: 'bg', type: 'background', paint: { 'background-color': '#fafaf8' } },
    { id: 'bm', type: 'raster', source: 'bm', paint: { 'raster-opacity': IMAGERY ? ['interpolate', ['linear'], ['zoom'], 4.5, 1, 6, 0] : 1, 'raster-fade-duration': 200 } },
    ...(IMAGERY ? [{ id: 's2', type: 'raster', source: 's2', minzoom: 4.5, paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 4.5, 0, 6, 1], 'raster-fade-duration': 200 } }] : []),
    { id: 'hillshade', type: 'hillshade', source: 'dem', minzoom: TERRAIN_MIN_ZOOM, paint: { 'hillshade-exaggeration': 0.3, 'hillshade-shadow-color': '#4a4a46', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#5a5a5a' } },
    // (aquí se insertan los rásteres GEM, FWI y LHASA, antes de "spc-fill")
    { id: 'spc-fill', type: 'fill', source: 'spc-areas', layout: vis(), paint: { 'fill-color': ['get', 'fill'], 'fill-opacity': 0.35 } },
    { id: 'spc-line', type: 'line', source: 'spc-areas', layout: vis(), paint: { 'line-color': ['get', 'stroke'], 'line-width': 1 } },
    { id: 'nws-fill', type: 'fill', source: 'nws', layout: vis(), paint: { 'fill-color': ['get', 'fill'], 'fill-opacity': 0.3 } },
    { id: 'nws-line', type: 'line', source: 'nws', layout: vis(), paint: { 'line-color': ['get', 'stroke'], 'line-width': 1.6 } },
    // Alertas del SMN: las vigentes con color pleno; las que empiezan más adelante, tenues y con borde punteado.
    { id: 'smn-fill', type: 'fill', source: 'smn', layout: vis(), paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['case', ['get', 'next'], 0.14, 0.38] } },
    { id: 'smn-line', type: 'line', source: 'smn', filter: ['!', ['get', 'next']], layout: vis(), paint: { 'line-color': ['get', 'c'], 'line-width': 1.4 } },
    { id: 'smn-line-next', type: 'line', source: 'smn', filter: ['get', 'next'], layout: vis(), paint: { 'line-color': ['get', 'c'], 'line-width': 1.2, 'line-dasharray': [2, 2] } },
    { id: 'borders', type: 'line', source: 'borders', layout: vis(true), paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1] } },
    { id: 'ring', type: 'line', source: 'ring', layout: { ...vis(true), 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#e8590c', 'line-opacity': 0.13, 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 1, 8, 6, 120] } },
    { id: 'plates', type: 'line', source: 'plates', layout: vis(true), paint: { 'line-color': '#ffffff', 'line-opacity': 0.9, 'line-dasharray': [2, 2], 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 8, 1.6] } },
    { id: 'slab', type: 'line', source: 'slab', layout: vis(), paint: { 'line-color': ['get', 'c'], 'line-opacity': ['case', ['get', 'major'], 0.95, 0.5], 'line-width': 1 } },
    { id: 'slab-label', type: 'symbol', source: 'slab', minzoom: 4, filter: ['get', 'major'], layout: { ...vis(), 'symbol-placement': 'line', 'text-field': ['concat', ['to-string', ['get', 'd']], ' km'], 'text-font': ['Noto Sans Regular'], 'text-size': 10 },
      paint: { 'text-color': '#141414', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 } },
    { id: 'platevec', type: 'line', source: 'platevec', layout: vis(), paint: { 'line-color': '#ffffff', 'line-width': 1.4, 'line-opacity': 0.9 } },
    { id: 'platehead', type: 'symbol', source: 'platehead', layout: { ...vis(), 'icon-image': 'head', 'icon-size': 0.6, 'icon-rotate': ['get', 'rot'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true } },
    { id: 'ibt-lines', type: 'line', source: 'ibt-lines', layout: vis(), paint: { 'line-color': ['get', 'c'], 'line-width': 0.9, 'line-opacity': 0.45 } },
    { id: 'ibt-pts', type: 'circle', source: 'ibt-pts', layout: vis(), paint: { 'circle-color': ['get', 'c'], 'circle-radius': 2.2, 'circle-opacity': 0.6 } },
    { id: 'heat-map', type: 'heatmap', source: 'heat', maxzoom: 8, layout: vis(), paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'n'], 1, 0.3, 50, 1], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 7, 2],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 1, 6, 7, 22], 'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 8, 0],
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(255,200,0,0)', 0.2, 'rgba(255,200,0,.6)', 0.5, '#ff8c00', 0.8, '#f03e3e', 1, '#c92a2a'] } },
    { id: 'heat-pt', type: 'circle', source: 'heat', minzoom: 3, layout: vis(), paint: {
      'circle-color': ['case', ['>=', ['get', 'frp'], 100], '#e03131', '#f76707'], 'circle-radius': zoomScaled(['get', 'r'], 2) as never,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.15, 7, 0.9], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 5, 0, 8, 0.8] } },
    { id: 'storm-wind', type: 'fill', source: 'storm-areas', filter: ['==', ['get', 'k'], 'wind'], layout: vis(true), paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['get', 'o'] } },
    { id: 'storm-cone', type: 'fill', source: 'storm-areas', filter: ['==', ['get', 'k'], 'cone'], layout: vis(true), paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.28 } },
    { id: 'storm-cone-line', type: 'line', source: 'storm-areas', filter: ['==', ['get', 'k'], 'cone'], layout: vis(true), paint: { 'line-color': '#141414', 'line-opacity': 0.7, 'line-width': 1.2, 'line-dasharray': [3, 2] } },
    { id: 'storm-past', type: 'line', source: 'storm-lines', filter: ['==', ['get', 'k'], 'past'], layout: { ...vis(true), 'line-cap': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': 3 } },
    { id: 'storm-fc', type: 'line', source: 'storm-lines', filter: ['==', ['get', 'k'], 'fc'], layout: vis(true), paint: { 'line-color': '#141414', 'line-width': 1.4, 'line-dasharray': [1, 2] } },
    { id: 'storm-fpts', type: 'circle', source: 'storm-pts', filter: ['==', ['get', 'k'], 'fc'], layout: vis(true), paint: { 'circle-color': ['get', 'c'], 'circle-radius': 4, 'circle-stroke-color': '#141414', 'circle-stroke-width': 1 } },
    { id: 'storm-mark', type: 'circle', source: 'storm-pts', filter: ['==', ['get', 'k'], 'now'], layout: vis(true), paint: {
      'circle-color': TYPE_COLOR.storm, 'circle-radius': zoomScaled(8) as never, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.4 } },
    { id: 'ev-tracks', type: 'line', source: 'ev-tracks', layout: vis(true), paint: { 'line-color': TYPE_COLOR.storm, 'line-width': 1.4, 'line-opacity': 0.6 } },
    { id: 'glc', type: 'circle', source: 'glc', layout: vis(), paint: { 'circle-color': TYPE_COLOR.landslide, 'circle-opacity': 0.4, 'circle-radius': zoomScaled(['get', 'r'], 2.4) as never } },
    { id: 'gvp', type: 'symbol', source: 'gvp', layout: { ...vis(), 'icon-image': 'tri-gvp', 'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 8, 0.8], 'icon-allow-overlap': true },
      paint: { 'icon-opacity': 0.85 } },
    { id: 'dart', type: 'symbol', source: 'dart', layout: { ...vis(), 'icon-image': 'dia-dart', 'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 8, 0.9], 'icon-allow-overlap': true },
      paint: { 'icon-opacity': ['case', ['get', 'on'], 1, 0.35] } },
    { id: 'spc-pts', type: 'circle', source: 'spc-pts', layout: vis(), paint: { 'circle-color': ['get', 'c'], 'circle-radius': zoomScaled(['get', 'r']) as never, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 } },
    { id: 'wind', type: 'symbol', source: 'wind', minzoom: 3.3, layout: { ...vis(), 'icon-image': ['step', ['get', 'kmh'], 'arrow-1', 30, 'arrow-2', 60, 'arrow-3'], 'icon-size': ['interpolate', ['linear'], ['get', 'kmh'], 0, 0.5, 60, 0.95], 'icon-rotate': ['get', 'to'],
      'icon-rotation-alignment': 'map', 'icon-allow-overlap': true } },
    { id: 'wvolc-new', type: 'circle', source: 'wvolc', filter: ['get', 'isNew'], layout: vis(true), paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': zoomScaled(11) as never, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
    { id: 'wvolc', type: 'symbol', source: 'wvolc', layout: { ...vis(true), 'icon-image': 'tri-volc', 'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.55, 8, 1], 'icon-allow-overlap': true } },
    // Eventos
    { id: 'ev', type: 'circle', source: 'ev', layout: { 'circle-sort-key': ['get', 'r'] }, paint: {
      'circle-color': ['get', 'c'], 'circle-radius': zoomScaled(['get', 'r']) as never, 'circle-opacity': 0.92, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.2 } },
    { id: 'ev-ring', type: 'circle', source: 'ev', filter: ['get', 'ring'], paint: {
      'circle-color': 'rgba(0,0,0,0)', 'circle-radius': zoomScaled(['+', ['get', 'r'], 5]) as never, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
    { id: 'ev-tsu', type: 'circle', source: 'ev', filter: ['get', 'tsu'], paint: {
      'circle-color': 'rgba(0,0,0,0)', 'circle-radius': zoomScaled(['+', ['get', 'r'], 3]) as never, 'circle-stroke-color': TYPE_COLOR.tsunami, 'circle-stroke-width': 1.5 } },
    { id: 'evc-cluster', type: 'circle', source: 'evc', filter: ['has', 'point_count'], paint: {
      'circle-color': '#141414', 'circle-opacity': 0.82, 'circle-radius': ['step', ['get', 'point_count'], 12, 50, 16, 300, 22], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } },
    { id: 'evc-count', type: 'symbol', source: 'evc', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-allow-overlap': true },
      paint: { 'text-color': '#ffffff' } },
    { id: 'evc-pt', type: 'circle', source: 'evc', filter: ['!', ['has', 'point_count']], layout: { 'circle-sort-key': ['get', 'r'] }, paint: {
      'circle-color': ['get', 'c'], 'circle-radius': zoomScaled(['get', 'r']) as never, 'circle-opacity': 0.92, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.2 } },
    { id: 'evc-ring', type: 'circle', source: 'evc', filter: ['all', ['!', ['has', 'point_count']], ['get', 'ring']], paint: {
      'circle-color': 'rgba(0,0,0,0)', 'circle-radius': zoomScaled(['+', ['get', 'r'], 5]) as never, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
    { id: 'ev-flash', type: 'circle', source: 'ev', filter: ['boolean', false], paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': 10, 'circle-stroke-color': ['get', 'c'], 'circle-stroke-width': 2.5, 'circle-stroke-opacity': 0 } },
    { id: 'sel', type: 'circle', source: 'sel', paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': zoomScaled(['+', ['get', 'r'], 8]) as never, 'circle-stroke-color': '#141414', 'circle-stroke-width': 2.2 } },
  ];

  return {
    version: 8,
    projection: { type: 'globe' },
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sky: {
      'sky-color': '#ffffff', 'horizon-color': '#f4f6f8', 'fog-color': '#ffffff', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.85,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    },
    sources,
    layers: L as unknown as LayerSpecification[],
  } as StyleSpecification;
}

/** Capas que se pueden tocar, de arriba hacia abajo. */
const PICK_LAYERS = ['sel', 'evc-cluster', 'ev', 'evc-pt', 'storm-mark', 'storm-fpts', 'wvolc', 'spc-pts', 'dart', 'heat-pt', 'gvp', 'ibt-pts', 'glc', 'smn-fill'];
/** Capa del Atlas → capas de MapLibre que muestra. */
const LAYER_MAP: Partial<Record<keyof Layers, string[]>> = {
  borders: ['borders'], plates: ['plates'], ring: ['ring'], gvp: ['gvp'], nhc: ['storm-wind', 'storm-cone', 'storm-cone-line', 'storm-past', 'storm-fc', 'storm-fpts', 'storm-mark'],
  firms: ['heat-map', 'heat-pt'], wvolc: ['wvolc', 'wvolc-new'], ibtracs: ['ibt-lines', 'ibt-pts'], slab: ['slab', 'slab-label'], platevec: ['platevec', 'platehead'],
  dart: ['dart'], wind: ['wind'], glc: ['glc'], spc: ['spc-fill', 'spc-line', 'nws-fill', 'nws-line', 'spc-pts'],
  smn: ['smn-fill', 'smn-line', 'smn-line-next'],
};

export const Globe = forwardRef<GlobeHandle, Props>(function Globe(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const queue = useRef<(() => void)[]>([]);
  const propsRef = useRef(props);
  propsRef.current = props;
  /** pid (propiedad de cada punto) → objeto original, para devolverlo al tocarlo. */
  const pick = useRef(new Map<string, Pickable>());
  const profile = useRef<Profile>({ mobile: false, slow: false });
  const evFeats = useRef<GeoJSON.Feature[]>([]);
  /** Generación del mapa: sube al recrearlo tras perder el contexto WebGL (todos los datos se vuelven a aplicar). */
  const [gen, setGen] = useState(0);
  const [lost, setLost] = useState(false);
  const lastClusterPlay = useRef(0);
  const terrainRef = useRef(props.terrain);
  terrainRef.current = props.terrain;
  const cleanupTerrain = useRef<() => void>(() => {});

  /** Ejecuta cuando el estilo ya tiene sus fuentes (los datos se cargan en paralelo y se aplican al llegar). */
  const whenReady = (fn: () => void) => { if (ready.current && mapRef.current) fn(); else queue.current.push(fn); };
  const setData = (id: string, data: GeoJSON.FeatureCollection) => whenReady(() => (mapRef.current!.getSource(id) as GeoJSONSource | undefined)?.setData(data));

  /**
   * Vuelo al evento en dos etapas, para que las teselas lleguen a tiempo:
   *  1. acercamiento suave sin inclinar hasta zoom ~5 (≈2 s), mientras se precargan las teselas del destino;
   *  2. cuando el mapa queda quieto con todo cargado (o a los 1,5 s), zoom final e inclinación (≈2,5 s).
   * En el celular o con conexión lenta, un 30 % más lento. Si el usuario toca o arrastra, se cancela.
   */
  const flight = useRef(0);
  const loadingMarker = useRef<maplibregl.Marker | null>(null);
  const hideLoading = () => { loadingMarker.current?.remove(); loadingMarker.current = null; };
  const showLoading = (lon: number, lat: number) => {
    const m = mapRef.current;
    if (!m || !terrainRef.current) return;
    hideLoading();
    const el = document.createElement('div');
    el.className = 'relief-loading';
    el.textContent = propsRef.current.loadingText ?? '…';
    loadingMarker.current = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -22] }).setLngLat([lon, lat]).addTo(m);
  };
  const cancelFlight = () => { flight.current++; hideLoading(); };
  const focus = (p: Pickable) => {
    const m = mapRef.current;
    if (!m) return;
    pristine.current = false;
    const id = ++flight.current;
    const prof = profile.current, k = prof.mobile || prof.slow ? 1.3 : 1;
    const center: [number, number] = [p.lon, p.lat];
    const zFinal = ZOOM_FOR[p.type] ?? 6.5;
    // En el celular el relieve levanta la cima por encima del centro: más margen arriba y menos inclinación.
    const h = m.getContainer().clientHeight;
    const padding = prof.mobile ? { top: Math.round(h * 0.3), bottom: 0, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 };
    const pitch = prof.mobile ? 50 : 58;
    prefetchTiles(p.lon, p.lat, zFinal, prof);
    const stage2 = () => {
      if (id !== flight.current) return;
      m.flyTo({ center, zoom: zFinal, pitch, bearing: -20, padding, duration: 2500 * k, curve: 1.2 });
      m.once('moveend', () => { if (id === flight.current) m.once('idle', () => { if (id === flight.current) hideLoading(); }); });
    };
    const near = m.getZoom() >= 4.5 && Math.abs(m.getCenter().lng - p.lon) < 3 && Math.abs(m.getCenter().lat - p.lat) < 3;
    if (near) { showLoading(p.lon, p.lat); stage2(); return; }
    m.flyTo({ center, zoom: Math.min(5, zFinal), pitch: 0, bearing: 0, padding, duration: 2000 * k, curve: 1.2 });
    m.once('moveend', () => {
      if (id !== flight.current) return;
      showLoading(p.lon, p.lat);
      let done = false;
      const go = () => { if (done) return; done = true; clearTimeout(timer); stage2(); };
      const timer = setTimeout(go, 1500);
      m.once('idle', go);
    });
  };
  /** Radio en px de la esfera a zoom 0 y pitch 0 (medido al ajustar): para calcular el zoom de reset sin saltos. */
  const radiusAt0 = useRef(0);
  /** El usuario todavía no movió la vista: al cambiar el tamaño, el globo se vuelve a ajustar. */
  const pristine = useRef(true);
  const reset = () => {
    cancelFlight();
    const m = mapRef.current, el = wrapRef.current;
    if (!m || !el) return;
    const b = freeBand(el);
    const zoom = radiusAt0.current ? Math.log2((FIT * Math.min(b.w, b.h)) / 2 / radiusAt0.current) : fitZoom(el);
    m.flyTo({ center: INITIAL.center, zoom, pitch: 0, bearing: 0, padding: { top: Math.round(b.top), bottom: Math.round(b.bottom), left: 0, right: 0 }, duration: 2200 });
    pristine.current = true;
  };
  useImperativeHandle(ref, () => ({
    focus,
    zoomBy: (f) => { const m = mapRef.current; if (m) m.easeTo({ zoom: m.getZoom() + Math.log2(f), duration: 400 }); },
    reset,
  }));

  /* ── Mapa ── */
  useEffect(() => {
    const wrap = wrapRef.current!;
    // ?v=lon,lat,zoom,pitch guarda la vista.
    const v = new URLSearchParams(window.location.search).get('v')?.split(',').map(Number);
    const fromUrl = v && v.length >= 3 && v.every(Number.isFinite);
    profile.current = deviceProfile();
    const m = new maplibregl.Map({
      container: wrap,
      style: buildStyle(profile.current),
      center: fromUrl ? [v[0], v[1]] : INITIAL.center,
      zoom: fromUrl ? v[2] : fitZoom(wrap),
      pitch: fromUrl ? v[3] ?? 0 : 0,
      maxPitch: 75,
      attributionControl: { compact: true },
      dragRotate: true,
      touchPitch: true,
      fadeDuration: 150,
      // Memoria: caché de teselas fuera de vista acotada por fuente (MapLibre usa por defecto ~5 pantallas:
      // ~175 teselas a 1440 px, que con imágenes y relieve suman cientos de MB) y resolución de dibujo
      // como mucho 2× (1,5× en el celular).
      maxTileCacheSize: profile.current.mobile ? 30 : 60,
      pixelRatio: Math.min(window.devicePixelRatio || 1, profile.current.mobile ? 1.5 : 2),
    });
    mapRef.current = m;
    countMaps(1);
    // Diagnóstico de memoria (lo leen las pruebas): teselas en vista y en caché por fuente, y una
    // estimación de las texturas de las fuentes ráster (256×256×4 bytes por tesela; elevación, el doble).
    (window as unknown as { __mapaTeselas: () => unknown }).__mapaTeselas = () => {
      const tm = (m as unknown as { style?: { tileManagers?: Record<string, { _inViewTiles?: { _tiles: object }; _outOfViewCache?: { order: unknown[] } }> } }).style?.tileManagers ?? {};
      const out: Record<string, [number, number]> = {};
      let bytes = 0;
      for (const [id, c] of Object.entries(tm)) {
        const inView = Object.keys(c._inViewTiles?._tiles ?? {}).length, cached = c._outOfViewCache?.order.length ?? 0;
        if (inView + cached) out[id] = [inView, cached];
        if (RASTER_SOURCES.has(id)) bytes += (inView + cached) * 262144 * (id === 'dem' ? 2 : 1);
      }
      return { teselas: out, texturasMB: Math.round(bytes / 1048576) };
    };

    // Contexto WebGL perdido (el navegador lo quita cuando le falta memoria gráfica): aviso y, si no
    // vuelve solo en 4 s, se recrea el mapa en lugar de dejar la pestaña colgada.
    let lostTimer: ReturnType<typeof setTimeout> | undefined;
    m.on('webglcontextlost', () => {
      setLost(true); cancelFlight();
      lostTimer = setTimeout(() => setGen((g) => g + 1), 4000);
    });
    m.on('webglcontextrestored', () => { clearTimeout(lostTimer); setLost(false); });

    // Pestaña oculta: se cancela el vuelo y se detiene la cámara (el navegador ya no pide cuadros).
    const onVis = () => { if (document.hidden) { cancelFlight(); m.stop(); } };
    document.addEventListener('visibilitychange', onVis);
    // Íconos que el estilo pide y todavía no existen: se dibujan en el momento (MapLibre 6).
    m.setMissingStyleImageResolver((id) => { const img = makeIcon(id); if (img && !m.hasImage(id)) m.addImage(id, img, { pixelRatio: 2 }); });
    m.on('load', () => {
      setLost(false);
      // Atribución compacta: el botón (i) la despliega; de entrada queda cerrada.
      wrap.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      // Vista inicial: zoom medido sobre la esfera dibujada, dentro de la franja libre (sin ?v en la URL).
      if (!fromUrl) {
        const { zoom } = fitGlobe(m, wrap);
        const r = globeRadius(m);
        if (r) radiusAt0.current = r / Math.pow(2, zoom);
      }
      ready.current = true;
      const q = queue.current; queue.current = [];
      q.forEach((fn) => fn());
    });

    // Tocar / pasar el mouse.
    const hit = (pt: maplibregl.PointLike): MapGeoJSONFeature | null => {
      const layers = PICK_LAYERS.filter((id) => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none');
      return m.queryRenderedFeatures(pt, { layers })[0] ?? null;
    };
    m.on('click', (e) => {
      const f = hit(e.point);
      if (!f) return;
      if (f.layer.id === 'evc-cluster') {
        (m.getSource('evc') as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id as number)
          .then((z) => m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z + 0.5, duration: 700 })).catch(() => {});
        return;
      }
      const p = pick.current.get(String(f.properties.pid));
      if (p) propsRef.current.onSelect(p);
    });
    let hoverId: string | null = null;
    m.on('mousemove', (e) => {
      const f = hit(e.point);
      const p = f && f.layer.id !== 'evc-cluster' ? pick.current.get(String(f.properties.pid)) ?? null : null;
      m.getCanvas().style.cursor = f ? 'pointer' : '';
      const id = p ? `${p.type}:${p.id}` : null;
      if (id !== hoverId) { hoverId = id; propsRef.current.onHover(p ? { e: p, x: e.point.x, y: e.point.y } : null); }
    });
    m.on('mouseout', () => { hoverId = null; propsRef.current.onHover(null); });

    // Vista: avisar al quedar quieto, guardar ?v= y medir los cuadros por segundo de cada movimiento.
    let frames = 0, t0 = 0;
    m.on('movestart', () => { frames = 0; t0 = performance.now(); });
    m.on('render', () => { if (m.isMoving()) frames++; });
    m.on('pitch', () => propsRef.current.onPitch?.(m.getPitch() > 10));
    m.on('moveend', () => {
      const dt = (performance.now() - t0) / 1000;
      if (dt > 1 && frames / dt < 24) propsRef.current.onLowFps?.(Math.round(frames / dt));
      const c = m.getCenter(), z = m.getZoom();
      propsRef.current.onView?.({ lon: c.lng, lat: c.lat, k: Math.pow(2, z - INITIAL.zoom) });
      const url = new URL(window.location.href);
      url.searchParams.set('v', [c.lng.toFixed(2), c.lat.toFixed(2), z.toFixed(2), Math.round(m.getPitch())].join(','));
      window.history.replaceState(window.history.state, '', url);
    });

    // El usuario toma el control: se cancela el vuelo en curso sin trabas.
    const interrupt = () => { pristine.current = false; if (loadingMarker.current || m.isMoving()) { cancelFlight(); m.stop(); } };
    for (const ev of ['mousedown', 'touchstart', 'wheel'] as const) wrap.addEventListener(ev, interrupt, { passive: true, capture: true });

    // Al cambiar el tamaño, si el usuario no tocó la vista, el globo se vuelve a ajustar a la franja libre.
    let refit: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      m.resize();
      clearTimeout(refit);
      refit = setTimeout(() => { if (ready.current && pristine.current && !fromUrl && !m.isMoving()) fitGlobe(m, wrap); }, 200);
    });
    ro.observe(wrap);
    return () => {
      clearTimeout(lostTimer); clearTimeout(refit);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      const gl = m.getCanvas().getContext('webgl2') ?? m.getCanvas().getContext('webgl');
      m.remove();
      // map.remove() ya suelta el contexto; por si el navegador lo retiene, se fuerza la pérdida.
      try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ya liberado */ }
      mapRef.current = null; ready.current = false; queue.current = [];
      countMaps(-1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen]);

  /* ── Geometrías fijas y placas (en paralelo con el estilo) ── */
  useEffect(() => {
    setData('borders', fc([{ type: 'Feature', properties: {}, geometry: BORDERS }]));
    setData('ring', fc([multiline(RING.coordinates)]));
    propsRef.current.onCarto({ state: 'wait' });
    fetch('/api/plates').then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: GeoJSON.FeatureCollection | GeoJSON.Geometry) => {
        setData('plates', 'type' in j && j.type === 'FeatureCollection' ? j : fc([{ type: 'Feature', properties: {}, geometry: j as GeoJSON.Geometry }]));
        propsRef.current.onCarto({ state: 'ok' });
      })
      .catch(() => propsRef.current.onCarto({ state: 'err' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen]);

  /* ── Terreno 3D: solo con el interruptor encendido y desde TERRAIN_MIN_ZOOM ── */
  useEffect(() => {
    whenReady(() => {
      const m = mapRef.current!;
      const apply = () => {
        const want = terrainRef.current && m.getZoom() >= TERRAIN_MIN_ZOOM - 0.5;
        if (want !== !!m.getTerrain()) m.setTerrain(want ? { source: 'dem', exaggeration: exaggeration(profile.current) } : null);
      };
      apply();
      m.on('zoom', apply);
      cleanupTerrain.current = () => m.off('zoom', apply);
    });
    return () => cleanupTerrain.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, props.terrain]);

  /* ── Visibilidad de capas ── */
  useEffect(() => {
    whenReady(() => {
      const m = mapRef.current!;
      for (const [k, ids] of Object.entries(LAYER_MAP)) for (const id of ids!) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', props.layers[k as keyof Layers] ? 'visible' : 'none');
      // Rásteres: se agregan la primera vez que se encienden.
      for (const id of Object.keys(RASTERS) as RasterId[]) {
        const on = props.layers[id];
        if (!m.getSource(id)) {
          if (!on) continue;
          propsRef.current.onRaster?.(id, 'wait');
          m.addSource(id, { type: 'image', url: RASTERS[id].url, coordinates: MERC });
          m.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': RASTERS[id].opacity, 'raster-fade-duration': 0 } }, 'spc-fill');
          const done = (e: maplibregl.MapSourceDataEvent) => { if (e.sourceId === id && e.isSourceLoaded) { propsRef.current.onRaster?.(id, 'ok'); m.off('sourcedata', done); } };
          m.on('sourcedata', done);
          m.on('error', (e) => { if ((e as unknown as { sourceId?: string }).sourceId === id) propsRef.current.onRaster?.(id, 'err'); });
        } else m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, props.layers]);

  /* ── Eventos (agrupados solo con más de 2.000 puntos, p. ej. un año) ── */
  useEffect(() => {
    const ids = pick.current;
    for (const k of [...ids.keys()]) if (k.startsWith('e:')) ids.delete(k);
    const feats = [...props.events].sort((a, b) => baseRadius(a) - baseRadius(b)).map((e, i) => {
      const pid = `e:${i}`; ids.set(pid, e);
      return pt(e.lon, e.lat, { pid, t: e.type, mag: e.mag ?? 0, c: TYPE_COLOR[e.type], r: +baseRadius(e).toFixed(2), ring: hasRing(e), tsu: !!e.tsunami && props.showTsunami, ts: appearAt(e) });
    });
    evFeats.current = feats;
    const clustered = feats.length > 2000;
    setData('ev', clustered ? EMPTY : fc(feats));
    setData('evc', clustered ? fc(feats) : EMPTY);
    const tracks = props.events.filter((e) => e.track && e.track.length > 1).map((e) => line(e.track!));
    setData('ev-tracks', fc(tracks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, props.events, props.showTsunami]);

  /* ── Selección ── */
  useEffect(() => {
    const s = props.selected;
    const r = s && s.type !== 'heat' && 'mag' in s && s.type === 'eq' ? baseRadius(s as DisasterEvent) : 6;
    setData('sel', s ? fc([pt(s.lon, s.lat, { r })]) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, props.selected]);

  /* ── Volcanes del Holoceno (referencia) ── */
  useEffect(() => {
    const ids = pick.current;
    setData('gvp', fc(props.gvp.map((v, i) => { const pid = `g:${i}`; ids.set(pid, v); return pt(v.lon, v.lat, { pid }); })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, props.gvp]);

  /* ── Ciclones (dependen también del cabezal de la línea de tiempo) ── */
  useEffect(() => {
    const ov = props.overlays;
    if (!ov) return;
    const ids = pick.current;
    for (const k of [...ids.keys()]) if (k.startsWith('s:')) ids.delete(k);
    const reg = (prefix: string, i: number, p: Pickable) => { const pid = `${prefix}:${i}`; ids.set(pid, p); return pid; };
    const head = props.playHead ?? null;
    // Ciclones: radios de viento, cono, trayectoria pasada (Saffir-Simpson), pronóstico y posición.
    const anim = ov.stormAnim ?? null;
    const areas: GeoJSON.Feature[] = [], lines: GeoJSON.Feature[] = [], pts: GeoJSON.Feature[] = [];
    ov.storms.forEach((st, i) => {
      // Animación de un ciclón (botón de la ficha) o reproducción de la línea de tiempo.
      const playing = anim && anim.id === st.id ? anim.t : head;
      if (playing != null && head != null && !(st.pastPoints ?? []).some((p) => p.time <= playing) && st.lastUpdate > playing) return;
      if (playing == null) for (const w of st.windField ?? []) areas.push({ type: 'Feature', properties: { k: 'wind', c: w.kt >= 64 ? '#e03131' : w.kt >= 50 ? '#ff922b' : '#ffd43b', o: w.kt >= 64 ? 0.3 : 0.22 }, geometry: w.geometry });
      if (st.cone && head == null) areas.push({ type: 'Feature', properties: { k: 'cone' }, geometry: st.cone });
      const pp = (st.pastPoints ?? []).filter((p) => playing == null || p.time <= playing);
      if (pp.length > 1) for (let j = 1; j < pp.length; j++) lines.push(line([[pp[j - 1].lon, pp[j - 1].lat], [pp[j].lon, pp[j].lat]], { k: 'past', c: ssColor(pp[j].kt) }));
      else if (playing == null) for (const l of st.pastTrack ?? []) lines.push(line(l, { k: 'past', c: '#5a5a5a' }));
      const fp = (st.forecastPoints ?? []).filter((p) => playing == null || (p.time ?? 0) <= playing);
      // (en la reproducción el cabezal nunca pasa de "ahora": no se dibuja el pronóstico)
      if (st.forecastTrack?.length && (playing == null || fp.length)) lines.push(line(playing == null ? st.forecastTrack : [[st.lon, st.lat], ...fp.map((p) => [p.lon, p.lat])], { k: 'fc' }));
      for (const p of fp) pts.push(pt(p.lon, p.lat, { k: 'fc', c: p.windKt != null ? ssColor(p.windKt) : '#ffffff' }));
      let mx = st.lon, my = st.lat;
      if (playing != null) {
        const seq = [...(st.pastPoints ?? []).map((p) => ({ lon: p.lon, lat: p.lat, t: p.time })), ...(st.forecastPoints ?? []).filter((p) => p.time != null).map((p) => ({ lon: p.lon, lat: p.lat, t: p.time! }))];
        const last = seq.filter((p) => p.t <= playing).pop();
        if (last) { mx = last.lon; my = last.lat; }
      }
      pts.push(pt(mx, my, { k: 'now', pid: reg('s', i, st) }));
    });
    setData('storm-areas', fc(areas)); setData('storm-lines', fc(lines)); setData('storm-pts', fc(pts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, props.overlays?.storms, props.overlays?.stormAnim, props.playHead]);

  /* ── Reproducción: filtro por tiempo en las capas (sin volver a cargar datos) ── */
  useEffect(() => {
    whenReady(() => {
      const m = mapRef.current!;
      const head = props.playHead ?? null;
      const until = (base: unknown[] | null): unknown[] | null => (head == null ? base : base ? ['all', base, ['<=', ['get', 'ts'], head]] : ['<=', ['get', 'ts'], head]);
      m.setFilter('ev', until(null) as never);
      m.setFilter('ev-ring', until(['get', 'ring']) as never);
      m.setFilter('ev-tsu', until(['get', 'tsu']) as never);
      // Focos FIRMS: los detectados hasta el cabezal.
      const heatF = head == null ? null : ['<=', ['get', 'last'], head];
      m.setFilter('heat-map', heatF as never); m.setFilter('heat-pt', heatF as never);
      // Destello de lo que acaba de aparecer: anillo del color del tipo que se agranda y se apaga.
      const span = props.flashSpan ?? 0;
      if (head != null && span > 0) {
        const age = ['interpolate', ['linear'], ['get', 'ts'], head - span, 1, head, 0];
        const r = ['+', ['get', 'r'], ['*', 14, age]];
        m.setFilter('ev-flash', ['all', ['<=', ['get', 'ts'], head], ['>', ['get', 'ts'], head - span]] as never);
        m.setPaintProperty('ev-flash', 'circle-stroke-opacity', ['-', 1, age] as never);
        m.setPaintProperty('ev-flash', 'circle-radius', ['interpolate', ['linear'], ['zoom'], 1, r, 8, ['*', 1.8, r]] as never);
      } else m.setFilter('ev-flash', ['boolean', false]);
      // Con más de 2.000 eventos (fuente agrupada) el filtro va en los datos, como mucho una vez por segundo (regenerar 17.000 puntos agrupados cuesta memoria).
      const feats = evFeats.current;
      if (feats.length > 2000) {
        const now = performance.now();
        if (head == null || now - lastClusterPlay.current > 1000) {
          lastClusterPlay.current = now;
          (m.getSource('evc') as GeoJSONSource | undefined)?.setData(fc(head == null ? feats : feats.filter((x) => (x.properties!.ts as number) <= head)));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, props.playHead, props.flashSpan, props.events]);

  /* ── Capas de otras fuentes ── */
  useEffect(() => {
    const ov = props.overlays;
    if (!ov) return;
    const ids = pick.current;
    const reg = (prefix: string, i: number, p: Pickable) => { const pid = `${prefix}:${i}`; ids.set(pid, p); return pid; };


    setData('heat', fc(ov.heat.map((h, i) => pt(h.lon, h.lat, { pid: reg('h', i, h), n: h.count, frp: h.frpMax, r: Math.min(10, 2 + Math.sqrt(h.count) * 0.7), last: h.last }))));
    setData('wvolc', fc(ov.volcanoes.map((v, i) => pt(v.lon, v.lat, { pid: reg('w', i, v), isNew: v.status === 'new' }))));
    const tl: GeoJSON.Feature[] = [];
    for (const tr of ov.tracks) for (let j = 1; j < tr.points.length; j++) tl.push(line([[tr.points[j - 1][0], tr.points[j - 1][1]], [tr.points[j][0], tr.points[j][1]]], { c: ssColor(tr.points[j][2]) }));
    setData('ibt-lines', fc(tl));
    setData('ibt-pts', fc(ov.tracks.map((tr, i) => pt(tr.lon, tr.lat, { pid: reg('t', i, tr), c: ssColor(tr.windKt) }))));
    setData('glc', fc((ov.glc ?? []).map((g, i) => pt(g.lon, g.lat, { pid: reg('l', i, g), r: +(1.2 + Math.min(2.2, Math.log10(1 + g.deaths) * 0.9)).toFixed(2) }))));
    setData('dart', fc((ov.darts ?? []).map((b, i) => pt(b.lon, b.lat, { pid: reg('d', i, b), on: b.reporting }))));
    setData('spc-areas', fc((ov.spcOutlook ?? []).map((a) => ({ type: 'Feature', properties: { fill: a.fill, stroke: a.stroke }, geometry: a.geometry }))));
    setData('nws', fc((ov.nwsWarnings ?? []).map((a) => ({ type: 'Feature', properties: { fill: a.fill, stroke: a.stroke }, geometry: a.geometry }))));
    // Las vigentes encima de las próximas (al tocar, gana la que ya rige); a igual estado, la de mayor nivel.
    const rank = (a: { onset: number; level: string }) => (a.onset <= Date.now() ? 10 : 0) + ['yellow', 'orange', 'red'].indexOf(a.level);
    setData('smn', fc((ov.smn ?? []).map((a, i) => ({ a, i })).sort((x, y) => rank(x.a) - rank(y.a))
      .map(({ a, i }) => ({ type: 'Feature', properties: { pid: reg('wx', i, a), c: SMN_COLORS[a.level], next: a.onset > Date.now() }, geometry: a.geometry }))));
    setData('spc-pts', fc((ov.spcReports ?? []).map((p, i) => pt(p.lon, p.lat, { pid: reg('p', i, p), c: SPC_COLORS[p.kind], r: p.kind === 'tornado' ? 5 : 3.5 }))));
    setData('wind', fc((ov.wind?.points ?? []).map(([lon, lat, kmh, to]) => pt(lon, lat, { kmh, to }))));

    // Losas Slab2: color por profundidad; las curvas cada 100 km, más marcadas y con rótulo.
    setData('slab', fc((ov.slab ?? []).map(([, d, lines2]) => {
      const t = Math.min(1, d / 600);
      return multiline(lines2, { d, major: d % 100 === 0, c: `rgb(${Math.round(255 - 140 * t)},${Math.round(190 - 150 * t)},${Math.round(60 + 170 * t)})` });
    })));
    // Movimiento de placas: segmento proporcional a la velocidad (0,05° por mm/año) y punta orientada.
    const vecs = ov.vectors ?? [], vl: GeoJSON.Feature[] = [], vh: GeoJSON.Feature[] = [];
    for (const [lon, lat, ve, vn] of vecs) {
      const s = 0.05, c = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
      const lon2 = lon + (ve * s) / c, lat2 = lat + vn * s;
      vl.push(line([[lon, lat], [lon2, lat2]]));
      vh.push(pt(lon2, lat2, { rot: (Math.atan2(ve, vn) * 180) / Math.PI }));
    }
    setData('platevec', fc(vl)); setData('platehead', fc(vh));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, props.overlays]);

  return (
    <>
      <div ref={wrapRef} className="globe-gl" style={{ position: 'absolute', inset: 0 }} />
      {lost && <div className="gl-lost" role="status">{props.lostText ?? '…'}</div>}
    </>
  );
});
