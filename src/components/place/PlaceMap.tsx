'use client';
/*
 * Mapa de "Mi lugar": 330 km alrededor del punto, con costas y fronteras (Natural Earth 1:50 millones vía
 * world-atlas), anillos cada 100 km, los sismos fuertes (círculos según la magnitud), los volcanes, los
 * tsunamis medidos y los deslizamientos con víctimas. Coordenadas: km al este y al norte del punto.
 */
import { useEffect, useRef, useState } from 'react';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { prep, useCanvasSize } from '../quake/clock';

type Geo = { land: GeoJSON.FeatureCollection | GeoJSON.Feature; borders: GeoJSON.MultiLineString };
let geoCache: Promise<Geo> | null = null;
export const loadGeo = () => (geoCache ??= import('world-atlas/countries-50m.json').then((m) => {
  const topo = (m.default ?? m) as unknown as Topology<{ countries: GeometryCollection }>;
  return { land: feature(topo, topo.objects.countries), borders: mesh(topo, topo.objects.countries, (a, b) => a !== b) as unknown as GeoJSON.MultiLineString };
}));

export type MapItems = {
  quakes: { lon: number; lat: number; mag: number }[];
  volcanoes: { lon: number; lat: number; name: string }[];
  runups: { lon: number; lat: number; height: number }[];
  slides: { lon: number; lat: number }[];
};

const HALF = 330;
const C = { quake: '#e8590c', volc: '#d6336c', tsu: '#1c6fb8', slide: '#7a5230' };

export function PlaceMap({ lang, lon, lat, name, items, legend }: { lang: Lang; lon: number; lat: number; name: string; items: MapItems; legend: Record<'place' | 'quake' | 'volc' | 'tsu' | 'slide' | 'ring', string> }) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);
  const [geo, setGeo] = useState<Geo | null>(null);
  useEffect(() => { loadGeo().then(setGeo).catch(() => {}); }, []);

  useEffect(() => {
    const c = cv.current;
    if (!c || !w) return;
    const ctx = prep(c, w, h, dpr);
    if (!ctx) return;
    const s = Math.min(w, h) / (2 * HALF), cos = Math.cos((lat * Math.PI) / 180);
    const xy = (lo: number, la: number): [number, number] => {
      let dl = lo - lon;
      if (dl > 180) dl -= 360; else if (dl < -180) dl += 360;
      return [w / 2 + dl * 111.32 * cos * s, h / 2 - (la - lat) * 111.32 * s];
    };
    ctx.fillStyle = '#cfe0ea'; ctx.fillRect(0, 0, w, h);
    const path = (coords: number[][]) => coords.forEach(([lo, la], i) => { const [x, y] = xy(lo, la); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    if (geo) {
      const feats = 'features' in geo.land ? geo.land.features : [geo.land];
      ctx.fillStyle = '#f4f1ea'; ctx.beginPath();
      for (const f of feats) { const g = f.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; for (const p of polys) for (const r of p) { path(r); ctx.closePath(); } }
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(70,90,110,.6)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = 'rgba(60,60,60,.5)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.beginPath();
      for (const line of geo.borders.coordinates) path(line);
      ctx.stroke(); ctx.setLineDash([]);
    }
    // Anillos cada 100 km.
    ctx.strokeStyle = 'rgba(20,20,20,.25)'; ctx.lineWidth = 1;
    ctx.font = '11px var(--font-isans), system-ui, sans-serif'; ctx.fillStyle = 'rgba(20,20,20,.6)'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    for (const r of [100, 200, 300]) { ctx.beginPath(); ctx.arc(w / 2, h / 2, r * s, 0, Math.PI * 2); ctx.stroke(); ctx.fillText(`${fmtNum(lang, r)} km`, w / 2 + 4, h / 2 - r * s - 2); }
    // Deslizamientos, tsunamis, sismos y volcanes (de atrás hacia adelante).
    for (const p of items.slides) { const [x, y] = xy(p.lon, p.lat); ctx.fillStyle = C.slide; ctx.fillRect(x - 3, y - 3, 6, 6); }
    for (const p of items.runups) { const [x, y] = xy(p.lon, p.lat); ctx.fillStyle = C.tsu; ctx.beginPath(); ctx.arc(x, y, 3 + Math.min(6, Math.sqrt(p.height) * 1.5), 0, Math.PI * 2); ctx.fill(); }
    for (const q of items.quakes) {
      const [x, y] = xy(q.lon, q.lat), r = Math.max(3, (q.mag - 4) * 4.5);
      ctx.fillStyle = 'rgba(232,89,12,.28)'; ctx.strokeStyle = C.quake; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.font = '600 11.5px var(--font-isans), system-ui, sans-serif'; ctx.textBaseline = 'middle';
    // Nombres de volcanes sin pisarse (la lista viene del más cercano al más lejano).
    const boxes: [number, number, number, number][] = [[w / 2 - 12, h / 2 - 10, w / 2 + 160, h / 2 + 10]];
    for (const v of items.volcanoes) {
      const [x, y] = xy(v.lon, v.lat);
      ctx.fillStyle = C.volc; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x - 6, y + 5); ctx.lineTo(x + 6, y + 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      const tw = ctx.measureText(v.name).width, b: [number, number, number, number] = [x + 7, y - 8, x + 10 + tw, y + 8];
      if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
      boxes.push(b);
      ctx.fillStyle = '#5a1630'; ctx.textAlign = 'left'; ctx.fillText(v.name, x + 8, y);
    }
    // El lugar.
    const [px, py] = [w / 2, h / 2];
    ctx.fillStyle = '#141414'; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5 - Math.PI / 2, r = k % 2 ? 4.5 : 10; ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = '600 13px var(--font-isans), system-ui, sans-serif'; ctx.textAlign = 'left';
    const tw = ctx.measureText(name).width;
    ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(px + 12, py - 9, tw + 8, 18);
    ctx.fillStyle = '#141414'; ctx.fillText(name, px + 16, py);
    ctx.textAlign = 'center'; ctx.fillText('N ↑', w - 22, 16);
  }, [w, h, dpr, geo, lon, lat, name, items, lang]);

  return (
    <div className="vs-map-wrap">
      <div ref={wrap} className="vs-map ml-map">
        <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label={`${name}: ${legend.ring}`} />
      </div>
      <div className="vs-legend" aria-hidden="true">
        <span><i className="ml-key ml-key-place" />{legend.place}</span>
        <span><i className="ml-key" style={{ background: 'rgba(232,89,12,.28)', borderColor: C.quake, borderRadius: '50%' }} />{legend.quake}</span>
        <span><i className="ml-key ml-key-volc" />{legend.volc}</span>
        <span><i className="ml-key" style={{ background: C.tsu, borderColor: C.tsu, borderRadius: '50%' }} />{legend.tsu}</span>
        <span><i className="ml-key" style={{ background: C.slide, borderColor: C.slide }} />{legend.slide}</span>
        <span>◯ {legend.ring}</span>
      </div>
    </div>
  );
}
