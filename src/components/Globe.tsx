'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { easeCubicInOut } from 'd3-ease';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { COL, RING, SHAPE, drawShape, fillFor, sizeFor } from '@/lib/symbols';
import type { DisasterEvent, GvpVolcano, SourceStatus } from '@/lib/types';

export type Pickable = DisasterEvent | GvpVolcano;
export type Layers = { borders: boolean; plates: boolean; ring: boolean; gvp: boolean; hazard: boolean };
export interface GlobeHandle { flyTo(lon: number, lat: number, k?: number): void; zoomBy(f: number): void; reset(): void }

type Props = {
  events: DisasterEvent[];
  gvp: GvpVolcano[];
  layers: Layers;
  selected: Pickable | null;
  showTsunami: boolean;
  onSelect(e: Pickable): void;
  onHover(h: { e: Pickable; x: number; y: number } | null): void;
  onCarto(s: SourceStatus): void;
};

const INITIAL_ROT: [number, number, number] = [70, 8, 0];
const K_MIN = 1, K_MAX = 16;
const clampK = (k: number) => Math.max(K_MIN, Math.min(K_MAX, k));

const topo = world as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
const LAND = feature(topo, topo.objects.land);
const BORDERS = mesh(topo, topo.objects.countries, (a, b) => a !== b);
const GRAT = geoGraticule10();

export const Globe = forwardRef<GlobeHandle, Props>(function Globe(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Estado de cámara fuera de React.
  const cam = useRef({ rot: [...INITIAL_ROT] as [number, number, number], k: 1, W: 0, H: 0, dpr: 1 });
  const plates = useRef<GeoPermissibleObjects | null>(null);
  const screenPts = useRef<{ e: Pickable; x: number; y: number; r: number }[]>([]);
  const raf = useRef(0);
  const anim = useRef(0);
  const projRef = useRef<GeoProjection>(geoOrthographic().clipAngle(90).precision(0.4));

  const draw = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    const { rot, k, W, H, dpr } = cam.current;
    if (!c || !ctx || !W) return;
    const { events, gvp, layers, selected, showTsunami } = propsRef.current;
    const proj = projRef.current;
    const path = geoPath(proj, ctx);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const R = (Math.min(W, H) / 2) * 0.86 * k;
    const cx = W / 2, cy = H / 2;
    proj.scale(R).translate([cx, cy]).rotate(rot);

    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = COL.bg; ctx.fill();
    ctx.beginPath(); path(GRAT); ctx.strokeStyle = COL.n200; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.beginPath(); path(LAND); ctx.fillStyle = COL.n200; ctx.fill();
    if (layers.borders) { ctx.beginPath(); path(BORDERS); ctx.strokeStyle = COL.n400; ctx.lineWidth = 0.5; ctx.stroke(); }
    if (layers.ring) {
      ctx.beginPath(); path(RING); ctx.strokeStyle = COL.tint; ctx.lineWidth = Math.max(8, 0.02 * R);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }
    if (layers.plates && plates.current) {
      ctx.beginPath(); path(plates.current); ctx.setLineDash([4, 3]); ctx.strokeStyle = COL.a700; ctx.lineWidth = 0.8; ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.strokeStyle = COL.text; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;

    // Marcas "+" de registro en las esquinas del cuadrado del globo.
    if (R * 2 < Math.min(W, H) + 1) {
      ctx.strokeStyle = COL.text; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
      for (const [x, y] of [[cx - R, cy - R], [cx + R, cy - R], [cx - R, cy + R], [cx + R, cy + R]]) {
        ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    const center: [number, number] = [-rot[0], -rot[1]];
    const front = (lon: number, lat: number) => geoDistance([lon, lat], center) < 1.55;
    const pts: typeof screenPts.current = [];

    if (layers.gvp) {
      ctx.strokeStyle = COL.n500; ctx.lineWidth = 0.8;
      const r = 2.6 * Math.pow(k, 0.2);
      for (const v of gvp) {
        if (!front(v.lon, v.lat)) continue;
        const [x, y] = proj([v.lon, v.lat])!;
        drawShape(ctx, 'triangle', x, y, r); ctx.stroke();
        pts.push({ e: v, x, y, r });
      }
    }

    ctx.strokeStyle = COL.a700; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
    for (const e of events) if (e.track) { ctx.beginPath(); path({ type: 'LineString', coordinates: e.track }); ctx.stroke(); }
    ctx.globalAlpha = 1;

    for (const e of events) {
      if (!front(e.lon, e.lat)) continue;
      const [x, y] = proj([e.lon, e.lat])!;
      const r = sizeFor(e, k);
      const st = fillFor(e);
      const sh = SHAPE[e.type];
      drawShape(ctx, sh, x, y, r);
      if (sh === 'cross') { ctx.strokeStyle = st.stroke; ctx.lineWidth = 1.6; ctx.stroke(); }
      else { ctx.fillStyle = st.fill; ctx.fill(); ctx.strokeStyle = st.stroke; ctx.lineWidth = 1; ctx.stroke(); }
      if (st.ring) { ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.strokeStyle = COL.a900; ctx.lineWidth = 1; ctx.stroke(); }
      if (e.tsunami && showTsunami) {
        ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.setLineDash([2, 2]); ctx.strokeStyle = COL.a900; ctx.stroke(); ctx.setLineDash([]);
      }
      pts.push({ e, x, y, r });
    }
    screenPts.current = pts;

    if (selected && front(selected.lon, selected.lat)) {
      const [x, y] = proj([selected.lon, selected.lat])!;
      const r = (selected.type === 'gvp' ? 4 : sizeFor(selected, k)) + 9;
      ctx.strokeStyle = COL.text; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1;
      for (const [a, b] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
        ctx.beginPath(); ctx.moveTo(a - 5, b); ctx.lineTo(a + 5, b); ctx.moveTo(a, b - 5); ctx.lineTo(a, b + 5); ctx.stroke();
      }
    }
  };

  const req = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = 0; draw(); });
  };

  const flyTo = (lon: number, lat: number, k2 = cam.current.k) => {
    cancelAnimationFrame(anim.current);
    const r0 = [...cam.current.rot];
    const k0 = cam.current.k;
    let tx = -lon;
    const ty = -lat;
    while (tx - r0[0] > 180) tx -= 360;
    while (tx - r0[0] < -180) tx += 360;
    const t0 = performance.now(), dur = 900;
    const target = clampK(k2);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur), e = easeCubicInOut(t);
      cam.current.rot = [r0[0] + (tx - r0[0]) * e, r0[1] + (ty - r0[1]) * e, 0];
      cam.current.k = k0 + (target - k0) * e;
      req();
      if (t < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };

  useImperativeHandle(ref, () => ({
    flyTo: (lon, lat, k) => flyTo(lon, lat, Math.max(cam.current.k, k ?? 0)),
    zoomBy: (f) => flyTo(-cam.current.rot[0], -cam.current.rot[1], cam.current.k * f),
    reset: () => flyTo(-INITIAL_ROT[0], -INITIAL_ROT[1], 1),
  }));

  // Redibujar cuando cambian datos, capas o selección.
  useEffect(req);

  // Placas tectónicas desde la API propia.
  useEffect(() => {
    propsRef.current.onCarto({ state: 'wait' });
    fetch('/api/plates')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { plates.current = j; propsRef.current.onCarto({ state: 'ok' }); req(); })
      .catch(() => propsRef.current.onCarto({ state: 'err' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tamaño, punteros, rueda, pellizco.
  useEffect(() => {
    const wrap = wrapRef.current!, c = canvasRef.current!;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
      Object.assign(cam.current, { W: r.width, H: r.height, dpr });
      req();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap); resize();

    const ptrs = new Map<number, { x: number; y: number }>();
    let moved = 0, multi = false;
    const rel = (e: PointerEvent) => { const b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    const pick = (x: number, y: number) => {
      let best: Pickable | null = null, bd = Infinity;
      for (const s of screenPts.current) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d <= Math.max(s.r + 3, 8) && d < bd) { bd = d; best = s.e; }
      }
      return best;
    };
    let hoverId: string | null = null;
    const setHover = (h: { e: Pickable; x: number; y: number } | null) => {
      const id = h?.e.id ?? null;
      if (id !== hoverId) { hoverId = id; propsRef.current.onHover(h); }
    };

    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, rel(e)); moved = 0; multi = ptrs.size > 1;
      cancelAnimationFrame(anim.current); c.style.cursor = 'grabbing'; setHover(null);
    };
    const move = (e: PointerEvent) => {
      const p = rel(e);
      if (!ptrs.has(e.pointerId)) {
        if (e.pointerType !== 'mouse') return;
        const hit = pick(p.x, p.y);
        setHover(hit ? { e: hit, x: p.x, y: p.y } : null);
        c.style.cursor = hit ? 'pointer' : 'grab';
        return;
      }
      const prev = ptrs.get(e.pointerId)!;
      if (ptrs.size === 1) {
        const dx = p.x - prev.x, dy = p.y - prev.y; moved += Math.abs(dx) + Math.abs(dy);
        const s = 0.28 / cam.current.k;
        const [rx, ry] = cam.current.rot;
        cam.current.rot = [rx + dx * s, Math.max(-89, Math.min(89, ry - dy * s)), 0];
      } else if (ptrs.size === 2) {
        const other = [...ptrs.entries()].find(([id]) => id !== e.pointerId)![1];
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(p.x - other.x, p.y - other.y);
        if (d0 > 0) cam.current.k = clampK(cam.current.k * d1 / d0);
        moved += 10;
      }
      ptrs.set(e.pointerId, p); req();
    };
    const up = (e: PointerEvent) => {
      const p = rel(e); const wasSingle = !multi;
      ptrs.delete(e.pointerId); c.style.cursor = 'grab';
      if (ptrs.size === 0 && wasSingle && moved < 6 && e.type === 'pointerup') {
        const hit = pick(p.x, p.y);
        if (hit) propsRef.current.onSelect(hit);
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); cancelAnimationFrame(anim.current);
      cam.current.k = clampK(cam.current.k * Math.exp(-e.deltaY * 0.0015)); req();
    };
    const leave = () => setHover(null);

    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', wheel, { passive: false }); c.addEventListener('pointerleave', leave);
    return () => {
      ro.disconnect(); cancelAnimationFrame(raf.current); cancelAnimationFrame(anim.current);
      c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up);
      c.removeEventListener('wheel', wheel); c.removeEventListener('pointerleave', leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'grab' }} />
    </div>
  );
});
