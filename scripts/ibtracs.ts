/**
 * IBTrACS v04r01 (NOAA NCEI): trayectorias históricas de todos los ciclones tropicales
 * del mundo. El archivo completo pesa ~330 MB y no se puede procesar en una función de
 * Vercel, así que este script lo convierte una vez en archivos compactos por temporada:
 *   public/data/ibtracs/<temporada>.json   y   public/data/ibtracs/index.json
 *
 * Solo la trayectoria principal (TRACK_TYPE = main), cada 6 h, coordenadas con un
 * decimal. Viento: USA_WIND (1 min, kt) si existe; si no, WMO_WIND (promedio de la
 * agencia regional). Presión: WMO_PRES o USA_PRES (hPa).
 *
 *   npm run ibtracs            # descarga (si falta) y convierte
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const URL = 'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.ALL.list.v04r01.csv';
const SRC = 'data/ibtracs.ALL.csv';
const OUT = 'public/data/ibtracs';

type Storm = { sid: string; name: string; basin: string; season: number; wind: number | null; pres: number | null; start: number; end: number; pts: [number, number, number | null][] };

async function download() {
  if (existsSync(SRC)) return;
  mkdirSync('data', { recursive: true });
  console.log('Descargando IBTrACS (~330 MB)…');
  const res = await fetch(URL);
  if (!res.ok || !res.body) throw new Error(`IBTrACS ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(SRC));
}

/** Parte una línea CSV de IBTrACS (sin comillas con comas adentro, salvo casos raros). */
const split = (line: string) => {
  const out: string[] = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
};
const num = (s: string | undefined) => (s == null || s.trim() === '' ? null : Number(s));

async function convert() {
  const rl = createInterface({ input: createReadStream(SRC), crlfDelay: Infinity });
  let head: string[] | null = null;
  let line = 0;
  const storms = new Map<string, Storm>();
  const I: Record<string, number> = {};
  for await (const raw of rl) {
    line++;
    if (line === 1) { head = split(raw).map((h) => h.trim()); head.forEach((h, i) => (I[h] = i)); continue; }
    if (line === 2) continue; // fila de unidades
    const c = split(raw);
    if (c[I.TRACK_TYPE]?.trim() !== 'main') continue;
    const time = Date.parse(c[I.ISO_TIME].trim().replace(' ', 'T') + 'Z');
    if (new Date(time).getUTCHours() % 6 !== 0 || new Date(time).getUTCMinutes() !== 0) continue;
    const sid = c[I.SID].trim();
    const lat = Number(c[I.LAT]), lon = Number(c[I.LON]);
    const wind = num(c[I.USA_WIND]) ?? num(c[I.WMO_WIND]);
    const pres = num(c[I.WMO_PRES]) ?? num(c[I.USA_PRES]);
    let s = storms.get(sid);
    if (!s) {
      const name = c[I.NAME].trim();
      s = { sid, name: name === 'NOT_NAMED' || name === 'UNNAMED' ? '' : name, basin: c[I.BASIN].trim(), season: Number(c[I.SEASON]), wind: null, pres: null, start: time, end: time, pts: [] };
      storms.set(sid, s);
    }
    s.end = time;
    if (wind != null && (s.wind == null || wind > s.wind)) s.wind = wind;
    if (pres != null && pres > 800 && (s.pres == null || pres < s.pres)) s.pres = pres;
    s.pts.push([Math.round(lon * 10) / 10, Math.round(lat * 10) / 10, wind]);
  }
  mkdirSync(OUT, { recursive: true });
  const bySeason = new Map<number, Storm[]>();
  for (const s of storms.values()) bySeason.set(s.season, [...(bySeason.get(s.season) ?? []), s]);
  const index: { season: number; storms: number }[] = [];
  for (const [season, list] of [...bySeason.entries()].sort((a, b) => a[0] - b[0])) {
    writeFileSync(`${OUT}/${season}.json`, JSON.stringify(list));
    index.push({ season, storms: list.length });
  }
  writeFileSync(`${OUT}/index.json`, JSON.stringify({ source: 'IBTrACS v04r01 (NOAA NCEI)', generated: new Date().toISOString(), seasons: index }));
  console.log(`${storms.size} ciclones en ${index.length} temporadas → ${OUT}`);
}

(async () => {
  await download();
  await convert();
})().catch((err) => { console.error(err); process.exit(1); });
