'use client';
/*
 * Mapa regional de la caída de ceniza: espesor del depósito en franjas (escala logarítmica), curvas de
 * 0,1 a 1000 mm, costas y fronteras (Natural Earth 1:50 millones vía world-atlas) y los lugares con su espesor.
 * Coordenadas: kilómetros al este y al norte del volcán (equirectangular local; alcanza para unos 1.000 km).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { contours } from 'd3-contour';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { prep, useCanvasSize } from '../quake/clock';
import type { AshOut } from './ash.worker';

/** Espesor (mm) a partir de la carga (kg/m²) con un depósito de 1000 kg/m³. */
export const mmFromLoad = (kgm2: number) => kgm2;
export const LEVELS_MM = [0.1, 1, 10, 100, 1000];
const BAND = ['rgba(255,236,170,.55)', 'rgba(250,190,95,.62)', 'rgba(232,120,40,.7)', 'rgba(190,50,30,.78)', 'rgba(110,20,20,.85)'];

export function fmtThick(lang: Lang, mm: number) {
  if (mm < 0.05) return '—';
  if (mm < 10) return `${fmtNum(lang, mm, mm < 1 ? 1 : 0)} mm`;
  if (mm < 1000) return `${fmtNum(lang, mm / 10, mm < 100 ? 1 : 0)} cm`;
  return `${fmtNum(lang, mm / 1000, 1)} m`;
}

type Geo = { land: GeoJSON.FeatureCollection | GeoJSON.Feature; borders: GeoJSON.MultiLineString };
let geoCache: Promise<Geo> | null = null;
const loadGeo = () => (geoCache ??= import('world-atlas/countries-50m.json').then((m) => {
  const topo = (m.default ?? m) as unknown as Topology<{ countries: GeometryCollection }>;
  return { land: feature(topo, topo.objects.countries), borders: mesh(topo, topo.objects.countries, (a, b) => a !== b) as unknown as GeoJSON.MultiLineString };
}));

type Props = {
  lang: Lang; ash: AshOut | null; vent: [number, number]; name: string; computing: boolean; computingText: string;
  /** Nube de ceniza en el aire de un aviso (polígono lon/lat), para comparar con la caída simulada. */
  cloud?: { ring: [number, number][]; label: string } | null;
};

export function AshMap({ lang, ash, vent, name, computing, computingText, cloud }: Props) {
  // Coordenadas como números: quien usa el mapa suele pasar un arreglo nuevo en cada render, y redibujar las
  // costas del mundo cada vez trababa la película (cientos de ms por redibujado).
  const [vlon, vlat] = vent;
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);
  const [geo, setGeo] = useState<Geo | null>(null);
  useEffect(() => { loadGeo().then(setGeo).catch(() => {}); }, []);

  // Curvas de espesor (en km respecto del volcán).
  const iso = useMemo(() => {
    if (!ash) return null;
    const vals = Array.from(ash.grid, (v) => mmFromLoad(v));
    return contours().size([ash.n, ash.n]).thresholds(LEVELS_MM)(vals);
  }, [ash]);

  useEffect(() => {
    const c = cv.current;
    if (!c || !w || !ash) return;
    const ctx = prep(c, w, h, dpr);
    if (!ctx) return;
    const cxKm = ash.cx / 1000, cyKm = ash.cy / 1000, cosV = Math.cos((vlat * Math.PI) / 180);
    const toKm = (lon: number, lat: number): [number, number] => {
      let dl = lon - vlon;
      if (dl > 180) dl -= 360; else if (dl < -180) dl += 360;
      return [dl * 111.32 * cosV, (lat - vlat) * 111.32];
    };
    // Recuadro de la grilla y, si hay, la nube del aviso entera.
    let halfKm = ((ash.n - 1) * ash.h) / 2000;
    if (cloud) for (const [lo, la] of cloud.ring) { const [x, y] = toKm(lo, la); halfKm = Math.max(halfKm, Math.abs(x - cxKm) * 1.06, Math.abs(y - cyKm) * 1.06); }
    // Escala: que entre el recuadro con márgenes; píxeles por km.
    const s = Math.min(w, h) / (2 * halfKm * 1.04);
    const X = (km: number) => w / 2 + (km - cxKm) * s, Y = (km: number) => h / 2 - (km - cyKm) * s;
    const lonLat = (lon: number, lat: number): [number, number] => { const [x, y] = toKm(lon, lat); return [X(x), Y(y)]; };
    ctx.fillStyle = '#cfe0ea'; ctx.fillRect(0, 0, w, h);
    const path = (coords: number[][]) => { coords.forEach(([lo, la], i) => { const [x, y] = lonLat(lo, la); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); };
    if (geo) {
      ctx.fillStyle = '#f4f1ea'; ctx.beginPath();
      const feats = 'features' in geo.land ? geo.land.features : [geo.land];
      for (const f of feats) {
        const g = f.geometry;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const poly of polys) for (const ring of poly) { path(ring); ctx.closePath(); }
      }
      ctx.fill('evenodd');
    }
    // Franjas de espesor.
    if (iso) {
      const gx = (i: number) => X(cxKm + (i - (ash.n - 1) / 2) * (ash.h / 1000)), gy = (j: number) => Y(cyKm + ((ash.n - 1) / 2 - j) * (ash.h / 1000));
      iso.forEach((band, k) => {
        ctx.beginPath();
        for (const poly of band.coordinates) for (const ring of poly) ring.forEach(([i, j], q) => { const x = gx(i - 0.5), y = gy(j - 0.5); if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.fillStyle = BAND[k]; ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(90,30,10,.55)'; ctx.lineWidth = 1; ctx.stroke();
      });
    }
    if (geo) {
      ctx.strokeStyle = 'rgba(60,60,60,.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.beginPath();
      for (const line of geo.borders.coordinates) path(line);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(70,90,110,.6)'; ctx.lineWidth = 0.8; ctx.beginPath();
      const feats = 'features' in geo.land ? geo.land.features : [geo.land];
      for (const f of feats) { const g = f.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; for (const poly of polys) for (const ring of poly) { path(ring); ctx.closePath(); } }
      ctx.stroke();
    }
    // Nube del aviso: contorno gris a rayas.
    if (cloud) {
      ctx.beginPath(); path(cloud.ring); ctx.closePath();
      ctx.fillStyle = 'rgba(70,70,80,.16)'; ctx.fill();
      ctx.strokeStyle = 'rgba(40,40,50,.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    // Lugares.
    ctx.font = '600 12px var(--font-isans), system-ui, sans-serif'; ctx.textBaseline = 'middle';
    for (const p of ash.places) {
      const [x, y] = lonLat(p.lon, p.lat);
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      const label = `${p.name} · ${fmtThick(lang, mmFromLoad(p.load))}`, tw = ctx.measureText(label).width;
      const right = x + 8 + tw < w - 4;
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(right ? x + 6 : x - 10 - tw, y - 8, tw + 4, 16);
      ctx.fillStyle = '#141414'; ctx.textAlign = right ? 'left' : 'right'; ctx.fillText(label, right ? x + 8 : x - 8, y);
    }
    // Volcán.
    const [vx, vy] = lonLat(vlon, vlat);
    ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.moveTo(vx, vy - 9); ctx.lineTo(vx - 8, vy + 6); ctx.lineTo(vx + 8, vy + 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#c8102e'; ctx.fillText(name, vx + 10, vy - 6);
    // Escala.
    const target = (2 * halfKm) / 5, nice = [1, 2, 5, 10, 20, 50, 100, 200, 500].reduce((b, k) => (k <= target ? k : b), 1);
    ctx.fillStyle = '#141414'; ctx.fillRect(12, h - 16, nice * s, 3);
    ctx.textAlign = 'left'; ctx.font = '11px var(--font-isans), system-ui, sans-serif'; ctx.fillText(`${fmtNum(lang, nice)} km`, 12, h - 26);
    // Norte.
    ctx.textAlign = 'center'; ctx.font = '600 12px var(--font-isans), system-ui, sans-serif'; ctx.fillText('N ↑', w - 22, 16);
  }, [w, h, dpr, ash, iso, geo, vlon, vlat, name, lang, cloud]);

  return (
    <div className="vs-map-wrap">
      <div ref={wrap} className="vs-map">
        <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label={ash ? ash.places.map((p) => `${p.name}: ${fmtThick(lang, mmFromLoad(p.load))}`).join('; ') : computingText} />
        {(computing || !ash) && <div className="vs-busy">{computingText}</div>}
      </div>
      <div className="vs-legend" aria-hidden="true">
        {LEVELS_MM.map((m, k) => <span key={m}><i style={{ background: BAND[k] }} />{k === LEVELS_MM.length - 1 ? `> ${fmtThick(lang, m)}` : `${fmtThick(lang, m)} – ${fmtThick(lang, LEVELS_MM[k + 1])}`}</span>)}
        {cloud && <span><i className="vs-legend-cloud" />{cloud.label}</span>}
      </div>
    </div>
  );
}
