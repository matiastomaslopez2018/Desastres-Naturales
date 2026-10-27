/*
 * «¿Y si pasara acá?»: mapa de intensidad de un sismo con el epicentro bajo un lugar elegido. Usa la misma
 * ruptura (source.ts) y los mismos modelos de movimiento del suelo (gmpe.ts) que el simulador, ahora en dos
 * dimensiones: la falla es un rectángulo de largo L a lo largo del rumbo (`strike`, grados desde el norte) y su
 * proyección en superficie va hacia la derecha del rumbo (hacia donde buza). Suelo uniforme (Vs30).
 */
import { G_CMS2, mmiFrom, motion, type Mechanism, type Setting } from './gmpe';
import { distances, rupture, type Rupture } from './source';

export type WhatIfInput = { mag: number; depth: number; setting: Setting; mech: Mechanism; vs30?: number };
export type WhatIfEvent = WhatIfInput & { id: string; name: string };

/** Intensidad media (MMI) en un punto a `along` km sobre el rumbo y `across` km perpendicular (hacia el buzamiento). */
export function mmiAt(i: WhatIfInput, rup: Rupture, along: number, across: number) {
  const mech = i.setting === 'crustal' ? i.mech : 'reverse';
  const d = distances(across, i.depth, rup), da = Math.max(0, Math.abs(along) - rup.length / 2);
  const s = { mag: i.mag, setting: i.setting, mech, depth: i.depth, rjb: Math.hypot(da, d.rjb), rrup: Math.hypot(da, d.rrup), rhypo: Math.hypot(along, across, i.depth) };
  const site = { vs30: i.vs30 ?? 360 };
  // Como en el simulador: con PGV si el modelo la tiene (corticales), si no con PGA.
  if (i.setting === 'crustal') return mmiFrom('pgv', motion('pgv', s, site).median);
  return mmiFrom('pga', motion('pga', s, site).median * G_CMS2);
}

/** Radio (km) perpendicular a la falla hasta donde la intensidad media es al menos `k`. */
function reach(i: WhatIfInput, rup: Rupture, k: number) {
  let lo = 0, hi = 2000;
  if (mmiAt(i, rup, 0, hi) >= k) return hi;
  if (mmiAt(i, rup, 0, 0) < k) return 0;
  for (let n = 0; n < 30; n++) { const m = (lo + hi) / 2; if (mmiAt(i, rup, 0, m) >= k) lo = m; else hi = m; }
  return lo;
}

export type ShakeGrid = {
  rup: Rupture;
  /** Medio lado del mapa (km). */
  half: number; n: number;
  /** Intensidad por celda, fila 0 al norte. */
  mmi: Float32Array;
  /** Intensidad en el lugar (sobre el epicentro). */
  here: number;
  /** Por grado (4 a 10): área (km²) y distancia máxima al lugar (km) con esa intensidad o más. */
  levels: { k: number; area: number; maxKm: number }[];
};

export function shakeGrid(i: WhatIfInput, strike: number, n = 160): ShakeGrid {
  const mech = i.setting === 'crustal' ? i.mech : 'reverse';
  const rup = rupture(i.mag, i.depth, i.setting, mech);
  // El mapa abarca hasta donde se siente como leve (IV), con un mínimo y un máximo.
  const half = Math.round(Math.min(1000, Math.max(100, (rup.length / 2 + reach(i, rup, 4)) * 1.08)));
  const mmi = new Float32Array(n * n), cell = (2 * half) / n;
  const a = (strike * Math.PI) / 180, sa = Math.sin(a), ca = Math.cos(a);
  const levels = [4, 5, 6, 7, 8, 9, 10].map((k) => ({ k, area: 0, maxKm: 0 }));
  for (let r = 0; r < n; r++) {
    const y = half - (r + 0.5) * cell;
    for (let c = 0; c < n; c++) {
      const x = -half + (c + 0.5) * cell;
      // Rumbo: sentido de la falla; "across" positivo a la derecha del rumbo (hacia donde buza).
      const along = x * sa + y * ca, across = x * ca - y * sa;
      const v = mmiAt(i, rup, along, across);
      mmi[r * n + c] = v;
      const dist = Math.hypot(x, y);
      for (const l of levels) if (v >= l.k) { l.area += cell * cell; if (dist > l.maxKm) l.maxKm = dist; }
    }
  }
  return { rup, half, n, mmi, here: mmiAt(i, rup, 0, 0), levels };
}

/** Sismo que llega por la URL (?m=&h=&amb=&mec=&t=), por ejemplo desde «Un día como hoy». */
export function customFromQuery(sp: Record<string, string | string[] | undefined>): WhatIfEvent | null {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const m = Number(one('m')), h = Number(one('h'));
  if (!Number.isFinite(m) || m < 4 || m > 9.6) return null;
  const amb = one('amb'), mec = one('mec');
  const setting: Setting = amb === 'interface' || amb === 'slab' ? amb : 'crustal';
  const mech: Mechanism = mec === 'strike-slip' || mec === 'normal' ? mec : 'reverse';
  return { id: 'url', name: (one('t') ?? `M ${m}`).slice(0, 120), mag: m, depth: Number.isFinite(h) ? Math.min(300, Math.max(1, h)) : 15, setting, mech };
}
