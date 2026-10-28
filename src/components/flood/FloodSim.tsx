'use client';
/*
 * Simulador de inundaciones: se elige un lugar, se toca el río, la laguna o el mar por donde entra el agua y se
 * sube el nivel con el deslizador. El área que se inunda (conectada con el origen y por debajo del nivel) se pinta
 * sobre la imagen satelital con la profundidad del agua. Cálculo en lib/flood.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasSource, Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, type Place } from '../place/PlaceProfile';
import { cellAt, floodLevels, loadDem, waterBase, type DemWindow } from '@/lib/flood';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';

const EXAMPLES: Place[] = [
  { name: 'Santa Fe', lat: -31.63, lon: -60.7 }, { name: 'Bahía Blanca', lat: -38.72, lon: -62.27 }, { name: 'Concordia', lat: -31.39, lon: -58.02 },
  { name: 'Porto Alegre', lat: -30.03, lon: -51.23 }, { name: 'Valencia', lat: 39.47, lon: -0.38 }, { name: 'Nueva Orleans', lat: 29.95, lon: -90.07 },
];

const T = {
  es: {
    examples: 'Por ejemplo', pick: 'Buscá un lugar y después tocá en el mapa el río, la laguna o el mar por donde entra el agua.',
    tap: 'Tocá en el mapa el río, la laguna o el mar por donde entra el agua.', loading: 'Cargando el relieve…', failed: 'No se pudo cargar el relieve de esa zona. Probá de nuevo.',
    rise: 'Subida del agua', base: (m: string) => `El agua parte de ${m} m sobre el nivel del mar (según el relieve).`,
    area: (a: string) => `Tierra bajo el agua: ${a} km²`, deep: (a: string) => `${a} km² con más de 1 m de agua`,
    edge: 'El agua llega al borde del área calculada (unos 15 a 20 km alrededor): podría extenderse más allá. Tocá más cerca de la zona que te interesa.',
    again: 'Tocá otro punto para cambiar el origen.', legend: 'Profundidad del agua',
    note: 'Es un modelo simple de "bañera": cubre de agua todo lo que está por debajo del nivel elegido y conectado con el punto de origen. No simula el caudal del río, la lluvia, cuánto dura la crecida, los desagües ni las defensas o terraplenes (que pueden contener el agua o, si fallan, empeorar todo), y el agua no se reparte de forma pareja en la realidad. El relieve es el de Terrain Tiles (sobre todo SRTM de la NASA, de unos 30 m; en EE. UU., USGS 3DEP): incluye en parte edificios y árboles y puede errar varios metros, sobre todo en zonas llanas. Para saber el riesgo real de tu barrio, consultá los mapas de riesgo hídrico de tu municipio o provincia.',
    src: 'Relieve: Terrain Tiles (Mapzen, AWS Open Data). Imagen: Sentinel-2 cloudless 2020 © EOX (CC BY-NC-SA 4.0).',
  },
  en: {
    examples: 'For example', pick: 'Search for a place, then tap on the map the river, lake or sea where the water comes in.',
    tap: 'Tap on the map the river, lake or sea where the water comes in.', loading: 'Loading terrain…', failed: 'The terrain for that area could not be loaded. Please try again.',
    rise: 'Water rise', base: (m: string) => `The water starts at ${m} m above sea level (from the terrain).`,
    area: (a: string) => `Land under water: ${a} km²`, deep: (a: string) => `${a} km² with more than 1 m of water`,
    edge: 'The water reaches the edge of the computed area (about 15 to 20 km around): it could extend further. Tap closer to the area you care about.',
    again: 'Tap another point to change the origin.', legend: 'Water depth',
    note: 'This is a simple "bathtub" model: it covers with water everything below the chosen level that is connected to the origin point. It does not simulate river flow, rain, how long the flood lasts, drains or levees (which may hold the water back or, if they fail, make things worse), and in reality water does not spread evenly. The terrain comes from Terrain Tiles (mostly NASA SRTM, about 30 m; USGS 3DEP in the US): it partly includes buildings and trees and may be off by several metres, especially on flat land. For the real risk in your neighbourhood, check the flood-risk maps of your local or regional government.',
    src: 'Terrain: Terrain Tiles (Mapzen, AWS Open Data). Imagery: Sentinel-2 cloudless 2020 © EOX (CC BY-NC-SA 4.0).',
  },
};

type Calc = { dem: DemWindow; level: Float32Array; base: number; seed: number };
/** Profundidad → color (celeste a azul oscuro), como RGBA. */
const shade = (d: number) => {
  const u = Math.min(1, d / 6);
  return [Math.round(116 - 92 * u), Math.round(192 - 92 * u), Math.round(252 - 81 * u), Math.round(150 + 70 * u)];
};

export function FloodSim({ lang }: { lang: Lang }) {
  const t = T[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const box = useRef<HTMLDivElement>(null), map = useRef<MLMap | null>(null), marker = useRef<Marker | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const placeRef = useRef<Place | null>(null);
  placeRef.current = place;
  const [calc, setCalc] = useState<Calc | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [rise, setRise] = useState(2);
  const [stats, setStats] = useState<{ area: number; deep: number; edge: boolean } | null>(null);
  const job = useRef(0);

  // Origen: relieve de la zona y niveles de inundación desde ese punto.
  const onPick = useCallback(async (lon: number, lat: number) => {
    const id = ++job.current;
    setState('loading');
    try {
      const dem = await loadDem(lon, lat);
      if (id !== job.current) return;
      const c = cellAt(dem, lon, lat)!;
      const { seed, base } = waterBase(dem.elev, dem.w, dem.h, c);
      setCalc({ dem, level: floodLevels(dem.elev, dem.w, dem.h, seed, base), base, seed });
      setState('idle');
    } catch {
      if (id === job.current) setState('failed');
    }
  }, []);

  // Mapa (MapLibre se carga solo en el navegador).
  useEffect(() => {
    let dead = false;
    import('maplibre-gl').then((ml) => {
      if (dead || !box.current) return;
      ml.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());
      const m = new ml.Map({
        container: box.current, center: [-60.7, -31.63], zoom: 3, attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            img: { type: 'raster', tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'], tileSize: 256, maxzoom: 15,
              attribution: '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless 2020</a> © EOX (CC BY-NC-SA 4.0)' },
            dem: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 13,
              attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a>' },
          },
          layers: [
            { id: 'img', type: 'raster', source: 'img' },
            { id: 'hs', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.25 } },
          ],
        },
      });
      m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      m.on('click', (e) => {
        if (m.getZoom() < 9) { m.flyTo({ center: e.lngLat, zoom: 12 }); return; }
        marker.current?.remove();
        marker.current = new ml.Marker({ color: '#1864ab' }).setLngLat(e.lngLat).addTo(m);
        onPick(e.lngLat.lng, e.lngLat.lat);
      });
      map.current = m;
      // Si el lugar llegó antes que el mapa (por la URL), se arranca ahí.
      const p0 = placeRef.current;
      if (p0) m.jumpTo({ center: [p0.lon, p0.lat], zoom: 12 });
    });
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, [onPick]);

  // ?lugar=&lat=&lon= (o ?place=): abrir directo en ese lugar (por ejemplo, desde una historia).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search), lat = Number(sp.get('lat')), lon = Number(sp.get('lon'));
    if (Number.isFinite(lat) && Number.isFinite(lon) && sp.get('lat') && sp.get('lon')) setPlace({ name: sp.get('lugar') ?? sp.get('place') ?? '', lat, lon });
  }, []);

  useEffect(() => { if (place) map.current?.flyTo({ center: [place.lon, place.lat], zoom: 12, duration: 2000 }); }, [place]);

  // Pinta el agua para la subida elegida (solo comparar niveles: rápido al mover el deslizador).
  useEffect(() => {
    const m = map.current;
    if (!m || !calc) return;
    const { dem, level, base } = calc, water = base + rise;
    const c = (canvas.current ??= document.createElement('canvas'));
    if (c.width !== dem.w) { c.width = dem.w; c.height = dem.h; }
    const ctx = c.getContext('2d')!, img = ctx.createImageData(dem.w, dem.h), px = img.data;
    // Tierra: celdas por encima del nivel de partida (el río o el mar ya tienen agua).
    let n = 0, deep = 0, edge = false;
    for (let i = 0; i < level.length; i++) {
      if (level[i] > water) continue;
      const d = water - dem.elev[i];
      px.set(shade(d), i * 4);
      if (dem.elev[i] > base) { n++; if (d > 1) deep++; }
      if (!edge) { const x = i % dem.w, y = (i - x) / dem.w; edge = x === 0 || y === 0 || x === dem.w - 1 || y === dem.h - 1; }
    }
    ctx.putImageData(img, 0, 0);
    const km2 = (dem.cellM * dem.cellM) / 1e6;
    setStats({ area: n * km2, deep: deep * km2, edge });
    const src = m.getSource('flood') as CanvasSource | undefined;
    if (!src) {
      m.addSource('flood', { type: 'canvas', canvas: c, coordinates: dem.corners, animate: false });
      m.addLayer({ id: 'flood', type: 'raster', source: 'flood', paint: { 'raster-opacity': 0.85, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
    } else {
      src.setCoordinates(dem.corners);
      // Fuente de lienzo estática: se relee el lienzo una vez.
      src.play(); requestAnimationFrame(() => src.pause());
    }
  }, [calc, rise]);

  return (
    <div className="fs">
      <Search lang={lang} onPick={setPlace} />
      <div className="ml-examples">
        <span className="qs-help">{t.examples}:</span>
        {EXAMPLES.map((p) => <button key={p.name} type="button" className="qs-chip" onClick={() => setPlace({ ...p })}>{p.name}</button>)}
      </div>
      <div className="fs-map-wrap">
        <div ref={box} className="fs-map" />
        <p className="fs-status" role="status">{state === 'loading' ? t.loading : state === 'failed' ? t.failed : !place && !calc ? t.pick : !calc ? t.tap : t.again}</p>
      </div>
      <div className="fs-controls">
        <label className="wi-field">
          <span className="qs-help">{t.rise}: <b>{nf(rise, 1)} m</b></span>
          <input type="range" min={0} max={15} step={0.1} value={rise} onChange={(e) => setRise(+e.target.value)} disabled={!calc} />
        </label>
        <div className="fs-legend" aria-hidden="true">
          <span className="faint small">{t.legend}:</span>
          <span className="fs-scale" />
          <span className="faint small">0 · 3 · 6+ m</span>
        </div>
      </div>
      {calc && stats && (
        <div className="fs-stats">
          <p className="ml-head">{t.area(nf(stats.area, stats.area < 10 ? 1 : 0))} · {t.deep(nf(stats.deep, stats.deep < 10 ? 1 : 0))}</p>
          <p className="ed-body">{t.base(nf(calc.base, 1))}</p>
          {stats.edge && <p className="ed-note">{t.edge}</p>}
        </div>
      )}
      <p className="ed-note">{t.note}</p>
      <p className="ed-note">{t.src}</p>
    </div>
  );
}
