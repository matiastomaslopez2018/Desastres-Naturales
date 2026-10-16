import type { AlertLevel, DisasterEvent, EventType } from './types';

export type FilterType = EventType | 'tsunami';
export type Shape = 'circle' | 'ring2' | 'triangle' | 'diamond' | 'square' | 'triDown' | 'cross';

export const TYPE_ORDER: FilterType[] = ['eq', 'tsunami', 'volcano', 'fire', 'storm', 'flood', 'drought'];
export const SHAPE: Record<FilterType, Shape> = {
  eq: 'circle', tsunami: 'ring2', volcano: 'triangle', fire: 'diamond', storm: 'square', flood: 'triDown', drought: 'cross',
};

/** 2a "Satélite nocturno": colores del globo en canvas (mismo valor que --type-* en base.css). */
export const NIGHT = {
  bg: '#06080c', sphere: '#0b1220', land: '#18243a',
  grat: 'rgba(120,160,220,.08)', borders: 'rgba(140,170,220,.18)', plates: 'rgba(255,122,61,.28)',
  ring: 'rgba(255,122,61,.10)', glow: 'rgba(80,140,255,.22)', rim: 'rgba(140,180,255,.35)',
  text: '#e6edf5', muted: '#9fb0c3', select: '#ff9a5c', alertOrange: '#ff9a5c', alertRed: '#ff3d3d', gvp: '#7d8ea2',
  type: {
    eq: '#ff7a3d', volcano: '#ff3d6e', fire: '#ffb547', storm: '#6ec8ff', flood: '#3d8bff', drought: '#c9a26b', tsunami: '#7af0e0',
  } as Record<FilterType, string>,
};

/** 2b "Periodístico": papel, tinta y un solo rojo (mapas estáticos, imagen OG). */
export const PAPER = {
  bg: '#faf8f3', sphere: '#f1eee6', land: '#dcd5c5', borders: '#faf8f3', grat: 'rgba(26,26,26,.06)',
  plates: 'rgba(26,26,26,.25)', ink: '#1a1a1a', muted: '#555', rule: '#d9d4c8', red: '#c8102e', highlight: 'rgba(200,16,46,.12)',
};

export const ALERT_RANK: Record<AlertLevel, number> = { green: 0, yellow: 1, orange: 2, red: 3 };
export const alertLevel = (e: Pick<DisasterEvent, 'alert' | 'pager'>) =>
  Math.max(e.alert ? ALERT_RANK[e.alert] : 0, e.pager ? ALERT_RANK[e.pager] : 0);

/** En el periodístico se destaca en rojo: alerta oficial naranja/roja o sismo M6+. */
export const isHighlighted = (e: DisasterEvent) => alertLevel(e) >= 2 || (e.type === 'eq' && (e.mag ?? 0) >= 6);

/** Estilo de un evento en papel: contorno de tinta, relleno rojo si es destacado. */
export function paperStyle(e: DisasterEvent) {
  return isHighlighted(e)
    ? { fill: PAPER.red, stroke: PAPER.red, fillOpacity: 0.85 }
    : { fill: e.type === 'eq' ? 'none' : PAPER.ink, stroke: PAPER.ink, fillOpacity: e.type === 'eq' ? 0 : 0.55 };
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
