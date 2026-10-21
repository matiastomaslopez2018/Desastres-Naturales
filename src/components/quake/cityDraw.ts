/*
 * Dibujo de la cuadra (Canvas 2D). Todo en metros, en el sistema local de cada construcción: origen en la
 * esquina inferior izquierda de la fachada, x a la derecha, y hacia arriba. La deformación lateral de cada
 * piso se aplica con una transformación afín de corte (el primer modo de un edificio de corte).
 *
 * Todo es función del tiempo (sin estado): escombros, polvo, derrumbes y tanques se calculan de nuevo en
 * cada cuadro, así que la barra de tiempo puede ir y volver.
 */
import type { DamageState, Kind } from '@/lib/quake/risk';

export const G = 9.80665;
/** Profundidad aparente (vista oblicua): desplazamiento de las caras lateral y superior, en metros. */
const DX = 1.1, DY = 0.7;

export type Lot = { i: number; x: number; w: number; storey: number; floors: number; roof: number; kind: Kind; H: number; tank: boolean };

type Rnd = () => number;
type Chunk = { t0: number; x: number; y: number; vx: number; vy: number; s: number; rot: number; vr: number; color: string; shape: number[]; glass?: boolean };
type Crack = { t0: number; pts: [number, number][]; w: number };
type Dust = { t0: number; x: number; y: number; r: number; grow: number; a: number };
type Spall = { t0: number; x: number; y: number; rx: number; ry: number };

export type Damage = {
  ds: DamageState; onset: number; collapseAt: number;
  mode: 'none' | 'topple' | 'pancake';
  cracks: Crack[]; chunks: Chunk[]; dust: Dust[]; spalls: Spall[];
  broken: Set<number>; tilt: number; dir: number;
  /** Esquina superior desprendida (daño extenso): lado y tamaño. */
  notch: { side: -1 | 1; w: number; h: number; pts: [number, number][] } | null;
  /** Perfil del montón de escombros (alturas relativas) y trozos encima. */
  mound: number[]; moundH: number; moundChunks: { x: number; y: number; s: number; rot: number; color: string; shape: number[] }[];
  /** Paneles de muro que vuelcan (adobe y ladrillo) con su sentido y demora. */
  panels: { x: number; w: number; dir: number; delay: number }[];
  tankFalls: boolean; tankDir: number;
};

export const MATERIAL: Record<Kind, { wall: string; wall2: string; frame: string; debris: string[]; roof: string }> = {
  adobe: { wall: '#c39a6b', wall2: '#a97f55', frame: '#7a5a3c', debris: ['#b98a5e', '#a77a50', '#8e6844', '#c99d72'], roof: '#9c4a2f' },
  brick: { wall: '#ad5038', wall2: '#8f3e2c', frame: '#e9e4da', debris: ['#a54a35', '#8f3e2c', '#c0664e', '#d9cfc0'], roof: '#8e8e88' },
  wood: { wall: '#dcd2bb', wall2: '#bfb397', frame: '#ffffff', debris: ['#d9cdb3', '#b8a88a', '#8a6f4e'], roof: '#6f7b83' },
  confined: { wall: '#ece4d2', wall2: '#cfc6b2', frame: '#9a9a94', debris: ['#e9e1cf', '#9a9a94', '#b04f3a', '#7d7d78'], roof: '#8e8e88' },
  'rc-frame': { wall: '#b8573f', wall2: '#9b4632', frame: '#a9a9a3', debris: ['#a6a6a0', '#b55a42', '#8c8c86', '#6f6f6a'], roof: '#8c8c86' },
  'rc-wall': { wall: '#c6cacc', wall2: '#a9afb2', frame: '#d5d8da', debris: ['#bfc3c6', '#9aa3a8', '#7b8a92', '#6c7378'], roof: '#9aa3a8' },
};

/** Oscurece o aclara un color hexadecimal (k entre −1 y 1). */
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
const blob = (r: Rnd, n = 6) => Array.from({ length: n }, () => 0.65 + r() * 0.5);

export function damageFor(lot: Lot, ds: DamageState, onset: number, collapseAt: number, r: Rnd): Damage {
  const mat = MATERIAL[lot.kind];
  const mode: Damage['mode'] = ds < 4 ? 'none' : lot.kind === 'adobe' || lot.kind === 'brick' || lot.kind === 'wood' ? 'topple' : 'pancake';
  const cracks: Crack[] = [], chunks: Chunk[] = [], dust: Dust[] = [], spalls: Spall[] = [];
  // Grietas diagonales (corte) en los pisos bajos; en X si el daño es moderado o más.
  const nCr = [0, 3, 7, 12, 4][ds];
  for (let k = 0; k < nCr; k++) {
    const fl = Math.floor(r() ** 2 * lot.floors), y0 = fl * lot.storey + 0.3 + r() * lot.storey * 0.4, x0 = 0.12 * lot.w + r() * 0.76 * lot.w;
    const dir = r() < 0.5 ? -1 : 1, len = 0.7 + r() * (ds >= 3 ? 2.3 : 1.2), steps = 7;
    const pts: [number, number][] = [[x0, y0]];
    for (let s = 1; s <= steps; s++) pts.push([x0 + (dir * len * s) / steps + (r() - 0.5) * 0.22, Math.min(lot.H - 0.1, y0 + ((len * s) / steps) * 0.85 + (r() - 0.5) * 0.16)]);
    cracks.push({ t0: onset + r() * 2.5, pts, w: ds >= 3 ? 0.09 : 0.05 });
  }
  for (let k = 0; k < [0, 0, 4, 7, 0][ds]; k++) spalls.push({ t0: onset + r() * 2.5, x: 0.5 + r() * (lot.w - 1), y: 0.4 + r() * Math.min(lot.H - 1, lot.storey * 1.6), rx: 0.3 + r() * 0.6, ry: 0.2 + r() * 0.45 });
  // Escombros: pedazos de revoque y mampostería que caen (muchos más en el derrumbe), y vidrios.
  const nCh = [0, 4, 18, 50, 140][ds];
  for (let k = 0; k < nCh; k++) {
    const collapse = ds === 4;
    chunks.push({
      t0: collapse ? collapseAt + r() * 2 : onset + r() * 3,
      x: r() * lot.w, y: collapse ? r() * lot.H * 0.9 : lot.H * (0.35 + r() * 0.65),
      vx: (r() - 0.5) * (collapse ? 5 : 2.4), vy: r() * 1.2,
      s: 0.12 + r() * (collapse ? 0.75 : 0.35), rot: r() * 6, vr: (r() - 0.5) * 7,
      color: mat.debris[Math.floor(r() * mat.debris.length)], shape: blob(r),
    });
  }
  if (lot.kind !== 'adobe' && ds >= 2) for (let k = 0; k < Math.round(nCh * 0.5); k++) {
    chunks.push({ t0: onset + r() * 2.2, x: r() * lot.w, y: lot.H * (0.15 + r() * 0.8), vx: (r() - 0.5) * 2.2, vy: r() * 0.8, s: 0.07 + r() * 0.12, rot: r() * 3, vr: (r() - 0.5) * 14, color: 'rgba(196,224,236,.95)', shape: blob(r, 3), glass: true });
  }
  const nDu = [0, 1, 4, 8, 20][ds];
  for (let k = 0; k < nDu; k++) {
    const t0 = ds === 4 ? collapseAt + 0.25 + r() * 1.6 : onset + r() * 3;
    dust.push({ t0, x: -1 + r() * (lot.w + 2), y: ds === 4 ? r() * lot.H * 0.35 : lot.H * (0.2 + r() * 0.7), r: 0.8 + r() * 1.6, grow: ds === 4 ? 2.6 + r() * 2.4 : 0.7 + r() * 0.8, a: ds === 4 ? 0.62 : 0.3 });
  }
  const broken = new Set<number>();
  const frac = [0, 0.05, 0.3, 0.65, 1][ds];
  for (let k = 0; k < 600; k++) if (r() < frac) broken.add(k);
  const side: -1 | 1 = r() < 0.5 ? -1 : 1;
  const nw = Math.min(lot.w * 0.4, 3.5), nh = Math.min(lot.H * 0.45, 1.2 + r() * 2.2);
  const notchPts: [number, number][] = [];
  for (let k = 0; k <= 6; k++) notchPts.push([(k / 6) * nw + (r() - 0.5) * 0.3, nh * (1 - k / 6) * (0.7 + r() * 0.5)]);
  const moundH = mode === 'topple' ? 0.45 * lot.storey * lot.floors + 0.8 : mode === 'pancake' ? 0.9 : 0;
  const mound = Array.from({ length: 15 }, () => 0.75 + r() * 0.5);
  const moundChunks = mode === 'none' ? [] : Array.from({ length: 22 + lot.floors * 4 }, () => ({ x: -1 + r() * (lot.w + 2), y: r(), s: 0.25 + r() * 0.8, rot: r() * 6, color: mat.debris[Math.floor(r() * mat.debris.length)], shape: blob(r) }));
  const np = Math.max(2, Math.round(lot.w / 2.6));
  const panels = mode === 'topple' ? Array.from({ length: np }, (_, j) => ({ x: (lot.w / np) * j, w: lot.w / np, dir: r() < 0.5 ? -1 : 1, delay: r() * 0.6 })) : [];
  return {
    ds, onset, collapseAt, mode, cracks, chunks, dust, spalls, broken,
    tilt: ds === 3 ? (r() < 0.5 ? -1 : 1) * (0.6 + r() * 1.2) : 0, dir: r() < 0.5 ? -1 : 1,
    notch: ds === 3 ? { side, w: nw, h: nh, pts: notchPts } : null,
    mound, moundH, moundChunks, panels, tankFalls: lot.tank && ds >= 2, tankDir: r() < 0.5 ? -1 : 1,
  };
}

/** Pedazo que cae: tiro balístico hasta el suelo; después se desliza y se frena. Coordenadas locales. */
function chunkAt(c: Chunk, tau: number) {
  const tHit = (c.vy + Math.sqrt(c.vy * c.vy + 2 * G * c.y)) / G;
  if (tau < tHit) return { x: c.x + c.vx * tau, y: c.y + c.vy * tau - 0.5 * G * tau * tau, rot: c.rot + c.vr * tau };
  const k = 3, after = tau - tHit;
  return { x: c.x + c.vx * tHit + (c.vx * 0.5 * (1 - Math.exp(-k * after))) / k, y: 0, rot: c.rot + c.vr * tHit };
}
function poly(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, shape: number[]) {
  ctx.beginPath();
  shape.forEach((rr, i) => { const a = rot + (i / shape.length) * Math.PI * 2; const px = x + Math.cos(a) * s * rr * 0.6, py = y + Math.sin(a) * s * rr * 0.45; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
  ctx.closePath();
}

/* ───────────── Construcción ───────────── */

export type BuildingState = {
  /** Desplazamiento del techo, ya exagerado (m). */
  uRoof: number;
  time: number;
};

/** Ventanas de un piso: [x, y, ancho, alto, esPuerta]. */
function openings(lot: Lot, k: number): [number, number, number, number, boolean][] {
  if (lot.kind === 'rc-wall') return [[0.9, 0.85, lot.w - 1.8, lot.storey * 0.5, false]];
  const n = Math.max(1, Math.floor(lot.w / (lot.kind === 'adobe' ? 3.2 : 2.5)));
  return Array.from({ length: n }, (_, j) => {
    const door = k === 0 && j === Math.floor(n / 2);
    const ww = door ? 1.0 : lot.kind === 'adobe' ? 0.9 : 1.15, wh = door ? 2.15 : lot.kind === 'adobe' ? 1.1 : 1.3;
    return [(lot.w / n) * (j + 0.5) - ww / 2, door ? 0 : lot.storey * 0.36, ww, wh, door];
  });
}

/** Un piso intacto en coordenadas sin deformar (el corte lo pone la transformación). */
function drawStorey(ctx: CanvasRenderingContext2D, lot: Lot, dm: Damage, k: number, y0: number, h: number, time: number) {
  const m = MATERIAL[lot.kind];
  // Cara lateral (vista oblicua) y frente con luz desde la izquierda.
  ctx.fillStyle = shade(m.wall, -0.32);
  ctx.beginPath(); ctx.moveTo(lot.w, y0); ctx.lineTo(lot.w + DX, y0 + DY); ctx.lineTo(lot.w + DX, y0 + h + DY); ctx.lineTo(lot.w, y0 + h); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(0, 0, lot.w, 0);
  g.addColorStop(0, shade(m.wall, 0.08)); g.addColorStop(1, shade(m.wall, -0.08));
  ctx.fillStyle = g; ctx.fillRect(0, y0, lot.w, h);
  // Hiladas, tablas o estructura.
  if (lot.kind === 'brick' || lot.kind === 'rc-frame') {
    ctx.strokeStyle = 'rgba(60,20,10,.18)'; ctx.lineWidth = 0.03;
    for (let yy = y0 + 0.22; yy < y0 + h - 0.05; yy += 0.22) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(lot.w, yy); ctx.stroke(); }
  } else if (lot.kind === 'wood') {
    ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 0.035;
    for (let yy = y0 + 0.28; yy < y0 + h; yy += 0.28) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(lot.w, yy); ctx.stroke(); }
  } else if (lot.kind === 'adobe') {
    ctx.fillStyle = 'rgba(90,60,30,.10)';
    for (let j = 0; j < 7; j++) ctx.fillRect(((j * 37) % 10) / 10 * lot.w, y0 + ((j * 53) % 10) / 10 * h, 0.9, 0.06);
  }
  if (lot.kind === 'confined' || lot.kind === 'rc-frame' || lot.kind === 'rc-wall') {
    // Columnas y viga (encadenados o pórtico de hormigón).
    ctx.fillStyle = lot.kind === 'rc-wall' ? shade(m.frame, -0.05) : m.frame;
    ctx.fillRect(0, y0, 0.32, h); ctx.fillRect(lot.w - 0.32, y0, 0.32, h); ctx.fillRect(0, y0 + h - 0.32, lot.w, 0.32);
    if (lot.kind === 'rc-frame') ctx.fillRect(lot.w / 2 - 0.16, y0, 0.32, h);
  }
  // Revoque desprendido (daño moderado o extenso): se ve el ladrillo.
  for (const sp of dm.spalls) {
    if (time < sp.t0 || sp.y < y0 || sp.y > y0 + h) continue;
    ctx.fillStyle = '#9c4a35'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, sp.rx, sp.ry, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,20,.35)'; ctx.lineWidth = 0.03; ctx.stroke();
  }
  // Aberturas.
  openings(lot, k).forEach(([x, y, w, hh, door], j) => {
    const id = k * 24 + j;
    const broken = !door && dm.broken.has(id) && time > dm.onset + (id % 9) * 0.22;
    ctx.fillStyle = m.frame; ctx.fillRect(x - 0.08, y0 + y - 0.08, w + 0.16, hh + 0.16);
    if (door) { ctx.fillStyle = '#5b4636'; ctx.fillRect(x, y0 + y, w, hh); return; }
    const gl = ctx.createLinearGradient(0, y0 + y, 0, y0 + y + hh);
    gl.addColorStop(0, broken ? '#1d2124' : lot.kind === 'rc-wall' ? '#9cc0d6' : '#b9d4e2'); gl.addColorStop(1, broken ? '#2c3236' : lot.kind === 'rc-wall' ? '#6f95ad' : '#7f9fb2');
    ctx.fillStyle = gl; ctx.fillRect(x, y0 + y, w, hh);
    if (broken) {
      ctx.strokeStyle = 'rgba(225,238,244,.75)'; ctx.lineWidth = 0.025;
      ctx.beginPath(); ctx.moveTo(x + w * 0.15, y0 + y + hh); ctx.lineTo(x + w * 0.55, y0 + y + hh * 0.35); ctx.lineTo(x + w * 0.85, y0 + y + hh * 0.8); ctx.stroke();
    } else if (lot.kind !== 'rc-wall') {
      ctx.strokeStyle = m.frame; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(x + w / 2, y0 + y); ctx.lineTo(x + w / 2, y0 + y + hh); ctx.stroke();
    }
    if (lot.kind === 'rc-frame' && k > 0) { ctx.fillStyle = '#8a8a85'; ctx.fillRect(x - 0.3, y0 + y - 0.18, w + 0.6, 0.14); ctx.strokeStyle = '#555'; ctx.lineWidth = 0.03; ctx.strokeRect(x - 0.3, y0 + y - 0.18, w + 0.6, 0.55); }
  });
}

function drawRoof(ctx: CanvasRenderingContext2D, lot: Lot, top: number) {
  const m = MATERIAL[lot.kind];
  if (lot.kind === 'adobe') {
    // Techo de tejas a un agua.
    ctx.fillStyle = shade(m.roof, -0.15);
    ctx.beginPath(); ctx.moveTo(-0.5, top); ctx.lineTo(lot.w + 0.5, top); ctx.lineTo(lot.w + 0.5 + DX, top + DY + lot.roof * 0.5); ctx.lineTo(-0.3 + DX, top + lot.roof + DY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = m.roof; ctx.fillRect(-0.5, top, lot.w + 1, 0.35);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.03;
    for (let x = -0.4; x < lot.w + 0.5; x += 0.35) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + 0.35); ctx.stroke(); }
  } else if (lot.kind === 'wood') {
    ctx.fillStyle = m.roof;
    ctx.beginPath(); ctx.moveTo(-0.4, top); ctx.lineTo(lot.w + 0.4, top); ctx.lineTo(lot.w / 2 + DX * 0.5, top + lot.roof + DY * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(m.roof, -0.2);
    ctx.beginPath(); ctx.moveTo(lot.w + 0.4, top); ctx.lineTo(lot.w + 0.4 + DX, top + DY); ctx.lineTo(lot.w / 2 + DX * 1.5, top + lot.roof + DY * 1.2); ctx.lineTo(lot.w / 2 + DX * 0.5, top + lot.roof + DY * 0.5); ctx.closePath(); ctx.fill();
  } else {
    // Azotea: cara superior y parapeto.
    ctx.fillStyle = shade(m.roof, 0.18);
    ctx.beginPath(); ctx.moveTo(0, top + lot.roof); ctx.lineTo(lot.w, top + lot.roof); ctx.lineTo(lot.w + DX, top + lot.roof + DY); ctx.lineTo(DX, top + lot.roof + DY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(m.roof, -0.3);
    ctx.beginPath(); ctx.moveTo(lot.w, top); ctx.lineTo(lot.w + DX, top + DY); ctx.lineTo(lot.w + DX, top + lot.roof + DY); ctx.lineTo(lot.w, top + lot.roof); ctx.closePath(); ctx.fill();
    ctx.fillStyle = m.roof; ctx.fillRect(0, top, lot.w, lot.roof);
  }
}

function drawTank(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#4b4b48'; ctx.fillRect(-0.55, 0, 0.12, 0.7); ctx.fillRect(0.43, 0, 0.12, 0.7);
  const g = ctx.createLinearGradient(-0.65, 0, 0.65, 0);
  g.addColorStop(0, '#3a6fb0'); g.addColorStop(0.45, '#5b8fd0'); g.addColorStop(1, '#2b5690');
  ctx.fillStyle = g; ctx.fillRect(-0.65, 0.7, 1.3, 1.25);
  ctx.fillStyle = '#6fa0dc'; ctx.beginPath(); ctx.ellipse(0, 1.95, 0.65, 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Dibuja una construcción completa en su sistema local (el llamador ya trasladó y escaló). */
export function drawBuilding(ctx: CanvasRenderingContext2D, lot: Lot, dm: Damage, st: BuildingState) {
  const { time } = st, H = lot.H, m = MATERIAL[lot.kind];
  const collapsing = dm.mode !== 'none' && time >= dm.collapseAt;
  const tau = time - dm.collapseAt;
  const uRoof = collapsing ? 0 : st.uRoof;
  const off = (y: number) => uRoof * Math.sin((Math.PI * Math.min(Math.max(y, 0), H)) / (2 * H));

  // Sombra sobre la vereda (luz desde la izquierda).
  ctx.fillStyle = 'rgba(0,0,0,.13)';
  ctx.beginPath(); ctx.moveTo(lot.w, 0); ctx.lineTo(lot.w + DX + 1.4, 0); ctx.lineTo(lot.w + DX + 1.4, -0.6); ctx.lineTo(lot.w, -0.6); ctx.closePath(); ctx.fill();

  // Montón de escombros (crece en el derrumbe).
  const drawMound = () => {
    if (dm.mode === 'none' || !collapsing) return;
    const grow = Math.min(1, tau / 1.8), Hm = dm.moundH * grow;
    if (Hm <= 0.01) return;
    ctx.fillStyle = shade(m.debris[0], -0.25);
    ctx.beginPath(); ctx.moveTo(-1.4, 0);
    dm.mound.forEach((v, i) => { const u = i / (dm.mound.length - 1), x = -1.4 + u * (lot.w + 2.8), bell = Math.sin(Math.PI * u) ** 0.7; ctx.lineTo(x, Hm * bell * v); });
    ctx.lineTo(lot.w + 1.4, 0); ctx.closePath(); ctx.fill();
    for (const c of dm.moundChunks) {
      const u = (c.x + 1.4) / (lot.w + 2.8), y = Hm * Math.sin(Math.PI * Math.max(0, Math.min(1, u))) ** 0.7 * (0.3 + 0.7 * c.y);
      ctx.fillStyle = c.color; poly(ctx, c.x, y, c.s, c.rot, c.shape); ctx.fill();
    }
    if (dm.mode === 'pancake') {
      ctx.strokeStyle = '#3b3530'; ctx.lineWidth = 0.05;
      for (let j = 0; j < 7; j++) { const x = (j / 6) * lot.w; ctx.beginPath(); ctx.moveTo(x, Hm * 0.5); ctx.lineTo(x + 0.4 * (j % 2 ? 1 : -1), Hm * 0.5 + 0.9); ctx.stroke(); }
    }
  };

  if (dm.mode === 'topple' && collapsing) {
    // Paneles de muro que vuelcan girando sobre su base (cuerpo rígido que cae), y el techo que se desploma.
    drawMound();
    const Hw = H;
    for (const p of dm.panels) {
      const tt = Math.max(0, tau - p.delay);
      const ang = Math.min(1.5, 0.08 + 0.5 * ((1.5 * G) / Hw) * tt * tt);
      if (ang >= 1.5 && tau > 2.4) continue; // ya es parte del montón
      ctx.save();
      const px = p.dir > 0 ? p.x + p.w : p.x;
      ctx.translate(px, 0); ctx.rotate(-p.dir * ang);
      ctx.fillStyle = shade(m.wall, -0.05); ctx.fillRect(p.dir > 0 ? -p.w : 0, 0, p.w, Hw * 0.92);
      ctx.fillStyle = '#2f2a25'; ctx.fillRect((p.dir > 0 ? -p.w : 0) + p.w * 0.3, Hw * 0.3, p.w * 0.35, Math.min(1.1, Hw * 0.3));
      ctx.restore();
    }
    const yRoof = Math.max(dm.moundH * Math.min(1, tau / 1.8), H - 0.5 * G * tau * tau);
    ctx.save(); ctx.translate(lot.w / 2, yRoof); ctx.rotate(dm.dir * Math.min(0.35, tau * 0.3)); ctx.translate(-lot.w / 2, -H);
    drawRoof(ctx, lot, H); ctx.restore();
  } else {
    // Alturas de cada piso: en el derrumbe tipo panqueque los pisos se aplastan de abajo hacia arriba.
    const heights = Array.from({ length: lot.floors }, (_, k) => {
      if (!collapsing) return lot.storey;
      const tk = tau - k * 0.3;
      return tk <= 0 ? lot.storey : Math.max(lot.storey * 0.2, lot.storey - 0.5 * G * tk * tk);
    });
    const tiltNow = dm.ds === 3 && time > dm.onset ? dm.tilt * Math.min(1, (time - dm.onset) / 2.5) : collapsing ? dm.dir * Math.min(7, tau * 6) : 0;
    ctx.save();
    ctx.translate(lot.w / 2, 0); ctx.rotate((-tiltNow * Math.PI) / 180); ctx.translate(-lot.w / 2, 0);
    let y = 0;
    for (let k = 0; k < lot.floors; k++) {
      const h = heights[k], y0 = y, y1 = y + h;
      const o0 = off(k * lot.storey), o1 = off((k + 1) * lot.storey);
      const kk = (o1 - o0) / Math.max(h, 1e-3);
      ctx.save();
      ctx.transform(1, 0, kk, 1, o0 - kk * y0, 0);
      if (h < lot.storey * 0.6) {
        // Piso aplastado: losa y escombros apretados.
        ctx.fillStyle = shade(m.debris[0], -0.35); ctx.fillRect(-0.3, y0, lot.w + 0.6, h);
        ctx.fillStyle = shade(m.frame, -0.25); ctx.fillRect(-0.4, y1 - 0.25, lot.w + 0.8, 0.25);
        for (let j = 0; j < 8; j++) { ctx.fillStyle = m.debris[j % m.debris.length]; poly(ctx, (j + 0.5) * (lot.w / 8), y0 + h * 0.5, 0.5, j, [1, 0.8, 1.1, 0.7, 0.9]); ctx.fill(); }
      } else {
        drawStorey(ctx, lot, dm, k, y0, h, time);
      }
      ctx.restore();
      y = y1;
    }
    const topOff = off(H);
    ctx.save(); ctx.translate(topOff, 0); drawRoof(ctx, lot, y);
    // Tanque de agua en la azotea: oscila con el techo o, con daño moderado o más, se cae.
    if (lot.tank) {
      const tx = lot.w * 0.68, ty = y + lot.roof;
      const tf = time - (dm.onset + 0.8);
      if (dm.tankFalls && tf > 0 && !collapsing) {
        const yy = ty - 0.5 * G * tf * tf;
        if (yy > 0) drawTank(ctx, tx + dm.tankDir * 1.2 * tf, yy, dm.tankDir * -Math.min(1.57, tf * 2.2));
        else drawTank(ctx, tx + dm.tankDir * (1.2 * Math.sqrt((2 * ty) / G) + 0.6), 0.65, dm.tankDir * -1.57);
      } else if (!collapsing) drawTank(ctx, tx, ty, -uRoof * 0.02);
    }
    ctx.restore();
    // Esquina desprendida (daño extenso).
    if (dm.notch && time > dm.onset + 0.6) {
      const n = dm.notch;
      ctx.save(); ctx.translate(topOff, 0);
      ctx.fillStyle = '#3a342e';
      ctx.beginPath();
      if (n.side > 0) { ctx.moveTo(lot.w + 0.05, y + lot.roof + 0.05); n.pts.forEach(([px, py]) => ctx.lineTo(lot.w - px, y + lot.roof - py)); ctx.lineTo(lot.w + 0.05, y - n.h); }
      else { ctx.moveTo(-0.05, y + lot.roof + 0.05); n.pts.forEach(([px, py]) => ctx.lineTo(px, y + lot.roof - py)); ctx.lineTo(-0.05, y - n.h); }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Grietas.
    if (!collapsing) {
      ctx.strokeStyle = '#2a211b'; ctx.lineCap = 'round';
      for (const c of dm.cracks) {
        const p = Math.min(1, (time - c.t0) / 1.2);
        if (p <= 0) continue;
        ctx.lineWidth = c.w;
        ctx.beginPath();
        const nPts = Math.max(2, Math.ceil(c.pts.length * p));
        c.pts.slice(0, nPts).forEach(([px, py], j) => (j ? ctx.lineTo(px + off(py), py) : ctx.moveTo(px + off(py), py)));
        ctx.stroke();
      }
    }
    ctx.restore();
    drawMound();
  }
}

/** Escombros y vidrios que caen (coordenadas locales de la construcción). */
export function drawChunks(ctx: CanvasRenderingContext2D, dm: Damage, time: number) {
  for (const c of dm.chunks) {
    const tau = time - c.t0;
    if (tau < 0) continue;
    const p = chunkAt(c, tau);
    ctx.fillStyle = c.color;
    poly(ctx, p.x, Math.max(0.05, p.y), c.s, p.rot, c.shape); ctx.fill();
    if (!c.glass) { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.02; ctx.stroke(); }
  }
}

/** Nubes de polvo: crecen, suben despacio y se las lleva una brisa hacia la derecha. */
export function drawDust(ctx: CanvasRenderingContext2D, dm: Damage, time: number) {
  for (const d of dm.dust) {
    const tau = time - d.t0;
    if (tau < 0) continue;
    const al = d.a * Math.exp(-tau / 6) * Math.min(1, tau * 2.5);
    if (al < 0.01) continue;
    const rr = d.r + d.grow * Math.sqrt(tau), x = d.x + tau * 0.5, y = d.y + tau * 0.35 + rr * 0.3;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, `rgba(196,182,158,${al})`); g.addColorStop(0.6, `rgba(196,182,158,${al * 0.6})`); g.addColorStop(1, 'rgba(196,182,158,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  }
}
