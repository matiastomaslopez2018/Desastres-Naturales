import 'server-only';
import { kvCached } from './kvCache';

/*
 * Alertas meteorológicas del Servicio Meteorológico Nacional (Argentina), en el formato internacional CAP 1.2.
 * El SMN publica la lista de alertas vigentes y próximas en https://ssl.smn.gob.ar/CAP/AR.php, cada una con su
 * archivo CAP: fenómeno, nivel (severity: Moderate = amarillo, Severe = naranja, Extreme = rojo), inicio y fin,
 * el polígono de la zona y qué hacer. Se leen cada 10 minutos.
 */

export type SmnLevel = 'yellow' | 'orange' | 'red';
export type SmnAlert = {
  id: string; event: string; level: SmnLevel;
  sent: number; onset: number; expires: number;
  description: string; instruction: string[];
  /** Polígonos de la zona: anillos de [lon, lat]. */
  polygons: [number, number][][];
  /** Centro aproximado (para filtrar por distancia y ubicar el aviso). */
  lon: number; lat: number;
  url: string;
};

const UA = 'Mozilla/5.0 (compatible; MapaDeDesastres/1.0; +https://desastres-naturales-rho.vercel.app)';
const LEVEL: Record<string, SmnLevel> = { Moderate: 'yellow', Severe: 'orange', Extreme: 'red' };

const decode = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
const tag = (x: string, k: string) => decode(new RegExp(`<${k}>([\\s\\S]*?)</${k}>`).exec(x)?.[1] ?? '');

async function get(url: string) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}

/** Un archivo CAP del SMN → alerta (null si no es meteorológica o no tiene zona). */
export function parseCap(xml: string, url: string): SmnAlert | null {
  const info = /<info>([\s\S]*?)<\/info>/.exec(xml)?.[1];
  if (!info) return null;
  const level = LEVEL[tag(info, 'severity')];
  const polygons = [...info.matchAll(/<polygon>([^<]+)<\/polygon>/g)].map((m) => m[1].trim().split(/\s+/).map((p) => { const [la, lo] = p.split(',').map(Number); return [lo, la] as [number, number]; })
    .filter(([lo, la]) => Number.isFinite(lo) && Number.isFinite(la))).filter((r) => r.length >= 4);
  if (!level || !polygons.length) return null;
  const pts = polygons.flat(), lon = pts.reduce((a, p) => a + p[0], 0) / pts.length, lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  // "1- Evitá salir. 2- No saques la basura…" → una lista.
  const instruction = tag(info, 'instruction').split(/\s*\d+\s*-\s+/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean);
  return {
    id: tag(xml, 'identifier'), event: tag(info, 'event'), level,
    sent: Date.parse(tag(xml, 'sent')), onset: Date.parse(tag(info, 'onset')), expires: Date.parse(tag(info, 'expires')),
    description: tag(info, 'description'), instruction, polygons, lon, lat, url,
  };
}

async function load(): Promise<SmnAlert[]> {
  const html = await get('https://ssl.smn.gob.ar/CAP/AR.php');
  const urls = [...new Set([...html.matchAll(/href="(https:\/\/ssl\.smn\.gob\.ar\/feeds\/CAP\/xml_generados\/[^"]+\.xml)"/g)].map((m) => m[1]))].slice(0, 120);
  const out: SmnAlert[] = [];
  // De a 8 por vez, para no saturar al SMN.
  for (let i = 0; i < urls.length; i += 8) {
    const r = await Promise.allSettled(urls.slice(i, i + 8).map(async (u) => parseCap(await get(u), u)));
    for (const x of r) if (x.status === 'fulfilled' && x.value) out.push(x.value);
  }
  const now = Date.now();
  return out.filter((a) => a.expires > now).sort((a, b) => a.onset - b.onset);
}

/** Alertas vigentes y próximas del SMN (10 minutos de caché). */
export async function getSmnAlerts() {
  const r = await kvCached('smn:alerts', 10 * 6e4, load);
  return { alerts: r.value.filter((a) => a.expires > Date.now()), fetchedAt: r.at, stale: r.stale };
}

/** ¿El punto cae dentro de la zona de la alerta? (rayo, sobre los polígonos en lon/lat). */
export function covers(a: SmnAlert, lon: number, lat: number) {
  return a.polygons.some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}
