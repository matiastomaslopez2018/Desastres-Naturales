'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { easeCubicInOut } from 'd3-ease';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { NIGHT, RING, SHAPE, alertLevel, drawShape, isHighlighted, sizeFor } from '@/lib/symbols';
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
const HALO_DPR = 2;
const RAD = Math.PI / 180;

/** [λ en radianes, sen φ, cos φ] por evento, calculado una vez. */
const trigCache = new WeakMap<DisasterEvent, [number, number, number]>();
const trig = (e: DisasterEvent) => {
  let t = trigCache.get(e);
  if (!t) { const p = e.lat * RAD; t = [e.lon * RAD, Math.sin(p), Math.cos(p)]; trigCache.set(e, t); }
  return t;
};
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
  // Mientras se arrastra, hace zoom o vuela: cuadros livianos (sin halos ni desenfoque de paneles).
  const moving = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const halos = useRef(new Map<string, HTMLCanvasElement>());
  const tracksFor = useRef<{ src: DisasterEvent[] | null; geom: GeoJSON.MultiLineString | null }>({ src: null, geom: null });

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
    // En movimiento, contornos con menos remuestreo (más rápido, imperceptible mientras gira).
    proj.scale(R).translate([cx, cy]).rotate(rot).precision(moving.current ? 2 : 0.4);
    const TAU = Math.PI * 2;

    // Atmósfera: halo azul alrededor de la esfera (solo si la esfera entra en pantalla).
    if (R < Math.max(W, H)) {
      const g = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
      g.addColorStop(0, NIGHT.glow); g.addColorStop(1, 'rgba(80,140,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = NIGHT.sphere; ctx.fill();
    ctx.beginPath(); path(GRAT); ctx.strokeStyle = NIGHT.grat; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.beginPath(); path(LAND); ctx.fillStyle = NIGHT.land; ctx.fill();
    if (layers.borders) { ctx.beginPath(); path(BORDERS); ctx.strokeStyle = NIGHT.borders; ctx.lineWidth = 0.5; ctx.stroke(); }
    if (layers.ring) {
      ctx.beginPath(); path(RING); ctx.strokeStyle = NIGHT.ring; ctx.lineWidth = Math.max(8, 0.02 * R);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }
    if (layers.plates && plates.current) {
      ctx.beginPath(); path(plates.current); ctx.strokeStyle = NIGHT.plates; ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.strokeStyle = NIGHT.rim; ctx.lineWidth = 1; ctx.stroke();

    const center: [number, number] = [-rot[0], -rot[1]];
    const front = (lon: number, lat: number) => geoDistance([lon, lat], center) < 1.55;
    const pts: typeof screenPts.current = [];

    if (layers.gvp) {
      ctx.strokeStyle = NIGHT.gvp; ctx.lineWidth = 0.8;
      const r = 2.6 * Math.pow(k, 0.2);
      for (const v of gvp) {
        if (!front(v.lon, v.lat)) continue;
        const [x, y] = proj([v.lon, v.lat])!;
        drawShape(ctx, 'triangle', x, y, r); ctx.stroke();
        pts.push({ e: v, x, y, r });
      }
    }

    // Trayectorias de ciclones.
    ctx.strokeStyle = NIGHT.type.storm; ctx.lineWidth = 1; ctx.globalAlpha = 0.45;
    if (tracksFor.current.src !== events) {
      const lines = events.filter((e) => e.track && e.track.length > 1).map((e) => e.track!);
      tracksFor.current = { src: events, geom: lines.length ? { type: 'MultiLineString', coordinates: lines } : null };
    }
    if (tracksFor.current.geom) { ctx.beginPath(); path(tracksFor.current.geom); ctx.stroke(); }
    ctx.globalAlpha = 1;

    // Eventos: color por tipo, tamaño por magnitud, brillo aditivo con halos precalculados
    // (sprites). En movimiento o con miles de puntos en pantalla se dibujan sin halo.
    // Proyección ortográfica directa con seno/coseno precalculados por evento: con un año
    // de datos (~13.000 eventos) es varias veces más rápida que proj() + geoDistance().
    const lam0 = -rot[0] * RAD, phi0 = -rot[1] * RAD;
    const sp0 = Math.sin(phi0), cp0 = Math.cos(phi0);
    const shown: { e: DisasterEvent; x: number; y: number; r: number }[] = [];
    for (const e of events) {
      const t = trig(e);
      const dl = t[0] - lam0, cdl = Math.cos(dl);
      if (sp0 * t[1] + cp0 * t[2] * cdl < 0.02) continue; // cara oculta
      const x = cx + R * t[2] * Math.sin(dl);
      const y = cy - R * (cp0 * t[1] - sp0 * t[2] * cdl);
      shown.push({ e, x, y, r: sizeFor(e, k) });
    }
    const glow = !moving.current && shown.length <= 4000;
    ctx.globalCompositeOperation = 'lighter';
    if (glow) {
      for (const { e, x, y, r } of shown) {
        const h = halo(NIGHT.type[e.type], r, isHighlighted(e));
        ctx.drawImage(h, x - h.width / 2 / HALO_DPR, y - h.height / 2 / HALO_DPR, h.width / HALO_DPR, h.height / HALO_DPR);
      }
    }
    for (const { e, x, y, r } of shown) {
      const col = NIGHT.type[e.type];
      const sh = SHAPE[e.type];
      drawShape(ctx, sh, x, y, r);
      if (sh === 'cross') { ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke(); }
      else { ctx.fillStyle = col; ctx.globalAlpha = 0.72; ctx.fill(); ctx.globalAlpha = 1; }
    }
    ctx.globalCompositeOperation = 'source-over';

    // Destacados (alerta oficial naranja/roja o sismo M6+, el mismo criterio que el rojo del
    // periodístico) llevan anillo; el indicador de tsunami, anillo punteado.
    for (const { e, x, y, r } of shown) {
      if (isHighlighted(e)) {
        const red = alertLevel(e) >= 3;
        ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU);
        ctx.strokeStyle = red ? NIGHT.alertRed : NIGHT.alertOrange; ctx.lineWidth = red ? 1.6 : 1.1; ctx.stroke();
      }
      if (e.tsunami && showTsunami) {
        ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.setLineDash([2, 2]);
        ctx.strokeStyle = NIGHT.type.tsunami; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      }
      pts.push({ e, x, y, r });
    }
    screenPts.current = pts;

    // Selección: dos anillos concéntricos (2a).
    if (selected && front(selected.lon, selected.lat)) {
      const [x, y] = proj([selected.lon, selected.lat])!;
      const r = (selected.type === 'gvp' ? 4 : sizeFor(selected, k)) + 8;
      ctx.strokeStyle = NIGHT.select; ctx.lineWidth = 1;
      ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x, y, r + 10, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  /**
   * Halo radial de un color y radio (redondeado a 0,5 px), dibujado una sola vez.
   * "soft": brillo tenue para todos; "strong": solo destacados (M6+ o alerta oficial).
   */
  const halo = (color: string, r: number, strong: boolean) => {
    const rr = Math.min(40, Math.round(r * 2) / 2);
    const key = color + rr + (strong ? 's' : 'w');
    let h = halos.current.get(key);
    if (!h) {
      const R = strong ? rr * 2.6 + 6 : rr * 2 + 3;
      h = document.createElement('canvas');
      h.width = h.height = Math.ceil(R * 2 * HALO_DPR);
      const g = h.getContext('2d')!;
      const c = h.width / 2;
      const grad = g.createRadialGradient(c, c, rr * 0.6 * HALO_DPR, c, c, R * HALO_DPR);
      grad.addColorStop(0, color + (strong ? '73' : '33')); grad.addColorStop(1, color + '00');
      g.fillStyle = grad; g.fillRect(0, 0, h.width, h.height);
      halos.current.set(key, h);
    }
    return h;
  };

  /** Marca la cámara en movimiento; al quedar quieta 160 ms, redibuja con calidad completa. */
  const markMoving = () => {
    if (!moving.current) { moving.current = true; wrapRef.current?.setAttribute('data-moving', ''); }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      moving.current = false; wrapRef.current?.removeAttribute('data-moving'); req();
    }, 160);
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
      markMoving(); req();
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

  // Solo en desarrollo: window.__globeBench(60) → ms promedio por cuadro girando el globo.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const w = window as unknown as { __globeBench?: (n?: number, asMoving?: boolean) => number };
    w.__globeBench = (n = 60, asMoving = false) => {
      moving.current = asMoving;
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { cam.current.rot = [cam.current.rot[0] + 2, cam.current.rot[1], 0]; draw(); }
      moving.current = false;
      return +((performance.now() - t0) / n).toFixed(2);
    };
    return () => { delete w.__globeBench; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      ptrs.set(e.pointerId, p); markMoving(); req();
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
      cam.current.k = clampK(cam.current.k * Math.exp(-e.deltaY * 0.0015)); markMoving(); req();
    };
    const leave = () => setHover(null);

    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', wheel, { passive: false }); c.addEventListener('pointerleave', leave);
    return () => {
      ro.disconnect(); cancelAnimationFrame(raf.current); cancelAnimationFrame(anim.current); clearTimeout(idleTimer.current);
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
