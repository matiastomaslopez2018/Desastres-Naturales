import 'server-only';
import { kvCached } from './kvCache';
import { getGvp } from './ingest';
import { VOLCANOES } from '../volcano/presets';
import type { Lang } from '../types';

/*
 * Ceniza volcánica en vivo: SIGMET internacionales de ceniza (VA) que publica el Aviation Weather Center de
 * la NOAA. Los emiten las oficinas de vigilancia meteorológica de cada región a partir de los avisos de los
 * centros de aviso de ceniza volcánica (VAAC). Cada uno trae el volcán, su posición, la nube observada
 * (polígono, base y tope) y hacia dónde se mueve. Es información para la aviación, no un pronóstico de caída.
 */

export type LiveAsh = {
  /** Nombre como lo escribe el SIGMET y, si se identifica, el del catálogo del Smithsonian. */
  name: string; gvp: string | null; country: Record<Lang, string> | null;
  lon: number; lat: number;
  /** Tope y base de la nube (km s. n. m.), hora de observación y validez (ms). */
  topKm: number; baseKm: number; validFrom: number; validTo: number; issued: number;
  /** Movimiento: hacia dónde (rumbo en grados, null si es estacionaria) y velocidad (km/h). */
  moveTo: number | null; moveKmh: number | null;
  cloud: [number, number][];
  fir: string; raw: string;
  /** Volcán del simulador (si es uno de los que tienen relieve e imagen). */
  sim: string | null;
};

type Isigmet = {
  firId: string; firName: string; receiptTime: string; validTimeFrom: number; validTimeTo: number; seriesId: string;
  hazard: string; qualifier: string | null; base: number | null; top: number | null; coords: { lon: number; lat: number }[] | null;
  dir: string | null; spd: string | null; rawSigmet: string;
};

const FT = 0.3048, KT = 1.852;
const COMPASS: Record<string, number> = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 };
const R = 6371;
const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180, dLa = (b[1] - a[1]) * r, dLo = (b[0] - a[0]) * r;
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLo / 2) ** 2));
};

/** Posición del volcán en el texto del SIGMET: "PSN N1428 W09052" (grados y minutos). */
function psn(raw: string): [number, number] | null {
  const m = /PSN\s+([NS])(\d{2})(\d{2})\s+([EW])(\d{3})(\d{2})/.exec(raw.replace(/\s+/g, ' '));
  if (!m) return null;
  const lat = (+m[2] + +m[3] / 60) * (m[1] === 'S' ? -1 : 1), lon = (+m[5] + +m[6] / 60) * (m[4] === 'W' ? -1 : 1);
  return [lon, lat];
}

/** Nombre del volcán en el texto: "VA ERUPTION MT NEVADOS DE CHILLAN PSN ..." (el campo qualifier a veces viene cortado). */
function volcanoName(raw: string, qualifier: string | null) {
  const m = /\bVA\s+(?:ERUPTION\s+)?(?:(?:MT|MOUNT|VOLCAN|VOLCANO)\s+)*(.+?)\s+PSN\b/.exec(raw.replace(/\s+/g, ' '));
  const n = m?.[1] ?? (qualifier ?? '').replace(/^ERUPTION\s+/i, '').replace(/^((MT|MOUNT|VOLCAN|VOLCANO)\s+)+/i, '');
  return n.trim().toLowerCase().replace(/(^|[\s/-])\p{L}/gu, (c) => c.toUpperCase()) || '—';
}

/** "Chillan, Nevados de" → "Nevados de Chillan" (así ordena los nombres el catálogo del GVP). */
const gvpName = (t: string) => t.replace(/^(.+?),\s*(.+)$/, '$2 $1');

async function load(): Promise<LiveAsh[]> {
  const r = await fetch('https://aviationweather.gov/api/data/isigmet?format=json&hazard=va', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`AWC ${r.status}`);
  const all = ((await r.json()) as Isigmet[]).filter((s) => s.hazard === 'VA');
  const gvp = await getGvp().catch(() => []);
  const now = Date.now();
  const byVolcano = new Map<string, LiveAsh>();
  for (const s of all) {
    if (s.validTimeTo * 1000 < now) continue;
    const cloud = (s.coords ?? []).map((c) => [c.lon, c.lat] as [number, number]);
    const pos = psn(s.rawSigmet) ?? (cloud.length ? cloud[0] : null);
    if (!pos) continue;
    // Volcán del catálogo más cercano a la posición informada (hasta 30 km).
    let best: (typeof gvp)[number] | null = null, bd = 30;
    for (const v of gvp) { const d = km(pos, [v.lon, v.lat]); if (d < bd) { bd = d; best = v; } }
    const simV = VOLCANOES.find((v) => (best && v.gvp === best.num) || km(pos, [v.lon, v.lat]) < 15);
    // Nombre: el del simulador; si no, el del catálogo, y si no, el del aviso.
    const name = simV?.name ?? (best ? gvpName(best.title) : volcanoName(s.rawSigmet, s.qualifier));
    const sim = simV?.id ?? null;
    const item: LiveAsh = {
      name, gvp: best?.title ?? null, country: simV?.country ?? (best?.country ? { es: best.country, en: best.country } : null), lon: pos[0], lat: pos[1],
      topKm: ((s.top ?? 0) * FT) / 1000, baseKm: ((s.base ?? 0) * FT) / 1000,
      validFrom: s.validTimeFrom * 1000, validTo: s.validTimeTo * 1000, issued: Date.parse(s.receiptTime),
      moveTo: s.dir && s.dir in COMPASS ? COMPASS[s.dir] : null, moveKmh: s.spd ? Math.round(+s.spd * KT) : null,
      cloud, fir: s.firName, raw: s.rawSigmet, sim,
    };
    // Un SIGMET por volcano: el de nube más alta (si hay varios, por ejemplo el observado y el pronosticado).
    const key = best ? `gvp-${best.num}` : name.toLowerCase();
    const prev = byVolcano.get(key);
    if (!prev || item.topKm > prev.topKm || (item.topKm === prev.topKm && item.issued > prev.issued)) byVolcano.set(key, item);
  }
  return [...byVolcano.values()].sort((a, b) => b.topKm - a.topKm);
}

/** Volcanes con un aviso de ceniza vigente (10 min de caché). */
export async function getLiveAsh() {
  const r = await kvCached('volcano:liveash:v2', 10 * 6e4, load);
  return { active: r.value, fetchedAt: r.at, stale: r.stale };
}
