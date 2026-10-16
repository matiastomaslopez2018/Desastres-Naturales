import type { AlertLevel, DisasterEvent, EventType } from './types';

export type FilterType = EventType | 'tsunami';
export type Shape = 'circle' | 'ring2' | 'triangle' | 'diamond' | 'square' | 'triDown' | 'cross';

export const TYPE_ORDER: FilterType[] = ['eq', 'tsunami', 'volcano', 'fire', 'storm', 'flood', 'drought'];
export const SHAPE: Record<FilterType, Shape> = {
  eq: 'circle', tsunami: 'ring2', volcano: 'triangle', fire: 'diamond', storm: 'square', flood: 'triDown', drought: 'cross',
};

/** Tokens del sistema Industry usados en el canvas (no lee CSS en caliente). */
export const COL = {
  bg: '#f2f2f3', text: '#1d1f20',
  n200: '#e7e7ea', n300: '#d4d4d7', n400: '#b7b7ba', n500: '#98989b',
  a300: '#b5d9fd', a: '#5980a6', a700: '#416180', a800: '#2c455d', a900: '#1d2d3d',
  tint: 'rgba(89,128,166,.22)',
};

export const ALERT_RANK: Record<AlertLevel, number> = { green: 0, yellow: 1, orange: 2, red: 3 };
export const alertLevel = (e: Pick<DisasterEvent, 'alert' | 'pager'>) =>
  Math.max(e.alert ? ALERT_RANK[e.alert] : 0, e.pager ? ALERT_RANK[e.pager] : 0);

export function fillFor(e: DisasterEvent) {
  const lvl = alertLevel(e);
  if (lvl >= 3) return { fill: COL.a900, stroke: COL.a900, ring: true };
  if (lvl === 2) return { fill: COL.a, stroke: COL.a800, ring: false };
  if (lvl === 1) return { fill: COL.a300, stroke: COL.a800, ring: false };
  return { fill: COL.tint, stroke: COL.a700, ring: false };
}

export function sizeFor(e: { type: string; mag?: number | null }, k: number) {
  const s = Math.pow(k, 0.22);
  if (e.type === 'eq') return (1.6 + Math.pow(Math.max(0, (e.mag ?? 2.5) - 2), 1.55) * 1.05) * s;
  if (e.type === 'fire') return 3.2 * s;
  return 5 * s;
}

/** Puntaje de "Más relevantes": alerta GDACS×2000 + PAGER×800 + (sismo M×100 | otros 250). */
export const relevance = (e: DisasterEvent) =>
  (e.alert ? ALERT_RANK[e.alert] : 0) * 2000 + (e.pager ? ALERT_RANK[e.pager] : 0) * 800 + (e.type === 'eq' ? (e.mag ?? 0) * 100 : 250);

export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, r: number) {
  ctx.beginPath();
  if (shape === 'circle' || shape === 'ring2') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === 'triangle') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); }
  else if (shape === 'triDown') { ctx.moveTo(x, y + r); ctx.lineTo(x + r, y - r * 0.8); ctx.lineTo(x - r, y - r * 0.8); ctx.closePath(); }
  else if (shape === 'diamond') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
  else if (shape === 'square') ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  else if (shape === 'cross') { ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); }
}

/** Igual que drawShape pero como atributo `d` de SVG. */
export function shapeD(shape: Shape, x: number, y: number, r: number): string {
  const f = (n: number) => n.toFixed(1);
  if (shape === 'circle' || shape === 'ring2') return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  if (shape === 'triangle') return `M${f(x)} ${f(y - r)}L${f(x + r)} ${f(y + r * 0.8)}L${f(x - r)} ${f(y + r * 0.8)}Z`;
  if (shape === 'triDown') return `M${f(x)} ${f(y + r)}L${f(x + r)} ${f(y - r * 0.8)}L${f(x - r)} ${f(y - r * 0.8)}Z`;
  if (shape === 'diamond') return `M${f(x)} ${f(y - r)}L${f(x + r)} ${f(y)}L${f(x)} ${f(y + r)}L${f(x - r)} ${f(y)}Z`;
  if (shape === 'square') return `M${f(x - r * 0.8)} ${f(y - r * 0.8)}h${f(r * 1.6)}v${f(r * 1.6)}h${f(-r * 1.6)}Z`;
  return `M${f(x - r)} ${f(y - r)}L${f(x + r)} ${f(y + r)}M${f(x + r)} ${f(y - r)}L${f(x - r)} ${f(y + r)}`;
}

/** Cinturón de Fuego — trazado aproximado, solo orientativo. */
export const RING: GeoJSON.MultiLineString = {
  type: 'MultiLineString',
  coordinates: [
    [[-70, -55], [-73, -45], [-72, -38], [-71.5, -30], [-71, -22], [-72, -17], [-77, -11], [-81, -4], [-79, 1], [-83, 8], [-88, 12], [-94, 15], [-101, 17], [-106, 21], [-110, 25], [-115, 31], [-121, 37], [-124.5, 42], [-125, 48], [-131, 53], [-138, 58], [-147, 60], [-155, 57.5], [-163, 54.5], [-172, 52], [-180, 51.3]],
    [[180, 51.3], [173, 52.5], [164, 55], [160, 52.5], [155, 48], [149, 45], [144, 42], [142, 38], [141, 35], [139, 33], [133, 31.5], [130, 29], [127, 25], [123, 23], [121, 19], [120, 15], [122, 11], [126, 7], [126.5, 2], [127, -1]],
    [[142, 34], [143, 26], [144, 19], [145, 13]],
    [[94, 8], [95, 3], [98, -1], [101.5, -4.5], [106, -7.8], [112, -9], [118, -10], [123, -10], [127, -8.5], [131, -6.5], [130, -4], [127, -1]],
    [[131, -2], [137, -3], [142, -4], [147, -6], [152, -6.5], [156, -7.5], [160, -10], [164, -12], [167, -15], [169, -20], [172, -23]],
    [[178, -16], [-175, -18], [-173, -21], [-175, -25], [-177, -30], [-178.5, -34], [178, -37.5], [176, -40], [173, -43], [167, -47]],
  ],
};
