/*
 * Datos de «Un día como hoy», en public/data/dia/MM-DD.json (un archivo por fecha, 366 en total):
 *   - Sismos significativos de NOAA NCEI (HazEL): con muertes, daños de US$ 1 M o más, magnitud 7,5 o más,
 *     intensidad X o más, o que generaron tsunami. Se marca si hubo tsunami y la ola más alta.
 *   - Tsunamis de NCEI (probables y confirmados) que no vienen de un sismo de la lista (volcanes, deslizamientos…).
 *   - Erupciones volcánicas significativas de NCEI.
 *   - Ciclones tropicales que llegaron a categoría 5 (viento de 137 kt o más) según IBTrACS v04r01, en el día de
 *     su máxima intensidad (de public/data/ibtracs, que arma `npm run ibtracs`).
 * Solo eventos con día y mes conocidos. Las fechas son las de cada catálogo (UTC en los sismos modernos).
 *   npm run this-day
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(en);

const API = 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1';
const OUT = join(process.cwd(), 'public', 'data', 'dia');
const IBT = join(process.cwd(), 'public', 'data', 'ibtracs');

/** Nombres de país de NCEI que no coinciden con el nombre ISO en inglés. */
const ALIAS: Record<string, string> = {
  USA: 'USA', 'USA TERRITORY': 'USA', RUSSIA: 'RUS', 'UNITED KINGDOM': 'GBR', UK: 'GBR', IRAN: 'IRN', 'SOUTH KOREA': 'KOR', 'NORTH KOREA': 'PRK',
  TAIWAN: 'TWN', VIETNAM: 'VNM', 'PAPUA NEW GUINEA': 'PNG', 'SOLOMON ISLANDS': 'SLB', VENEZUELA: 'VEN', BOLIVIA: 'BOL', SYRIA: 'SYR',
  TURKEY: 'TUR', TURKIYE: 'TUR', 'CZECH REPUBLIC': 'CZE', MACEDONIA: 'MKD', 'CONGO': 'COG', 'DEMOCRATIC REPUBLIC OF THE CONGO': 'COD', LAOS: 'LAO',
  'EAST TIMOR': 'TLS', 'TIMOR-LESTE': 'TLS', MOLDOVA: 'MDA', TANZANIA: 'TZA', MYANMAR: 'MMR', BURMA: 'MMR', 'IVORY COAST': 'CIV', 'CAPE VERDE': 'CPV',
};
const iso3 = (name?: string | null) => {
  if (!name) return null;
  const n = name.trim().toUpperCase();
  return ALIAS[n] ?? countries.getAlpha3Code(name.trim(), 'en') ?? countries.getAlpha3Code(n.charAt(0) + n.slice(1).toLowerCase(), 'en') ?? null;
};
/** "IRAN:  RAVAR" → "Ravar"; "CHILE:  VALDIVIA, PUERTO MONTT" → "Valdivia, Puerto Montt". */
const title = (s: string) => s.toLowerCase().replace(/(^|[\s,(/-])([a-záéíóúñü])/g, (_, a, b) => a + b.toUpperCase());
const placeOf = (loc?: string | null, country?: string | null) => {
  const s = (loc ?? '').replace(/\s+/g, ' ').trim();
  const i = s.indexOf(':');
  // Solo el país ("TURKEY"): sin lugar, que el país ya se muestra aparte.
  if (i < 0 && country && s.toUpperCase() === country.trim().toUpperCase()) return '';
  return title(i >= 0 ? s.slice(i + 1).trim() || s.slice(0, i) : s);
};

/** k: eq | tsunami | volcano | cyclone. */
type Item = {
  k: 'eq' | 'tsunami' | 'volcano' | 'cyclone'; y: number; place: string; iso3: string | null; lat: number | null; lon: number | null;
  mag?: number; depth?: number; vei?: number; h?: number; kt?: number; name?: string; tsu?: boolean; deaths?: number; url: string;
};

async function getJson<T>(url: string): Promise<T> {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      if (i === 4) throw e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

async function all<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 60; page++) {
    const j = await getJson<{ items?: T[]; totalPages?: number }>(`${API}/${path}${path.includes('?') ? '&' : '?'}page=${page}`);
    out.push(...(j.items ?? []));
    process.stdout.write(`\r${path}: ${out.length}`);
    if (!j.totalPages || page >= j.totalPages) break;
  }
  process.stdout.write('\n');
  return out;
}

type Eq = { id: number; year: number; month?: number; day?: number; locationName?: string; country?: string; latitude?: number; longitude?: number; eqMagnitude?: number; eqDepth?: number; deathsTotal?: number; deaths?: number; tsunamiEventId?: number };
type Ts = { id: number; year: number; month?: number; day?: number; locationName?: string; country?: string; latitude?: number; longitude?: number; eventValidity?: number; causeCode?: number; maxWaterHeight?: number; deathsTotal?: number; deaths?: number };
type Vo = { id: number; year: number; month?: number; day?: number; name?: string; location?: string; country?: string; latitude?: number; longitude?: number; vei?: number; deathsTotal?: number; deaths?: number };
type Storm = { sid: string; name: string; basin: string; season: number; wind: number | null; start: number; pts: [number, number, number | null][] };

const key = (m: number, d: number) => `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const num = (...v: (number | undefined)[]) => v.find((x) => x != null);

async function main() {
  const days = new Map<string, Item[]>();
  const add = (m: number | undefined, d: number | undefined, it: Item) => {
    if (!m || !d) return;
    const k = key(m, d);
    if (!days.has(k)) days.set(k, []);
    days.get(k)!.push(it);
  };

  const [eqs, tss, vos] = await Promise.all([all<Eq>('earthquakes'), all<Ts>('tsunamis/events'), all<Vo>('volcanoes')]);
  const tsById = new Map(tss.map((t) => [t.id, t]));
  const fromEq = new Set<number>();
  for (const e of eqs) {
    const t = e.tsunamiEventId != null ? tsById.get(e.tsunamiEventId) : undefined;
    const real = !!t && (t.eventValidity ?? 0) >= 3;
    if (e.tsunamiEventId != null) fromEq.add(e.tsunamiEventId);
    add(e.month, e.day, {
      k: 'eq', y: e.year, place: placeOf(e.locationName, e.country), iso3: iso3(e.country ?? e.locationName?.split(':')[0]), lat: e.latitude ?? null, lon: e.longitude ?? null,
      mag: e.eqMagnitude, depth: e.eqDepth, deaths: num(e.deathsTotal, e.deaths), tsu: real || undefined, h: real ? t!.maxWaterHeight : undefined,
      url: `https://www.ngdc.noaa.gov/hazel/view/hazards/earthquake/event-more-info/${e.id}`,
    });
  }
  for (const t of tss) {
    if (fromEq.has(t.id) || (t.eventValidity ?? 0) < 3) continue;
    add(t.month, t.day, {
      k: 'tsunami', y: t.year, place: placeOf(t.locationName, t.country), iso3: iso3(t.country), lat: t.latitude ?? null, lon: t.longitude ?? null,
      h: t.maxWaterHeight, deaths: num(t.deathsTotal, t.deaths), url: `https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/${t.id}`,
    });
  }
  for (const v of vos) {
    add(v.month, v.day, {
      k: 'volcano', y: v.year, name: v.name, place: v.location ?? '', iso3: iso3(v.country), lat: v.latitude ?? null, lon: v.longitude ?? null,
      vei: v.vei, deaths: num(v.deathsTotal, v.deaths), url: `https://www.ngdc.noaa.gov/hazel/view/hazards/volcano/event-more-info/${v.id}`,
    });
  }

  // Ciclones de categoría 5: el día (UTC) del punto de viento máximo; los puntos van cada 6 horas desde el inicio.
  let cyc = 0;
  if (existsSync(IBT)) {
    for (const f of readdirSync(IBT).filter((x) => /^\d{4}\.json$/.test(x))) {
      for (const s of JSON.parse(readFileSync(join(IBT, f), 'utf8')) as Storm[]) {
        if ((s.wind ?? 0) < 137) continue;
        let bi = 0;
        s.pts.forEach((p, i) => { if ((p[2] ?? -1) > (s.pts[bi][2] ?? -1)) bi = i; });
        const t = new Date(s.start + bi * 6 * 3600_000), p = s.pts[bi];
        add(t.getUTCMonth() + 1, t.getUTCDate(), {
          k: 'cyclone', y: t.getUTCFullYear(), name: s.name && s.name !== 'NOT_NAMED' ? title(s.name) : undefined, place: s.basin, iso3: null, lat: p[1], lon: p[0], kt: s.wind ?? undefined,
          url: `https://ncics.org/ibtracs/index.php?name=v04r01-${s.sid}`,
        });
        cyc++;
      }
    }
  }

  mkdirSync(OUT, { recursive: true });
  let n = 0;
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= new Date(Date.UTC(2024, m, 0)).getUTCDate(); d++) {
    const k = key(m, d);
    // Del más reciente al más antiguo; la página ordena como quiera.
    const items = (days.get(k) ?? []).sort((a, b) => b.y - a.y);
    n += items.length;
    writeFileSync(join(OUT, `${k}.json`), JSON.stringify(items.map((it) => Object.fromEntries(Object.entries(it).filter(([, v]) => v !== undefined && v !== null && v !== '')))));
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({ source: 'NOAA NCEI HazEL (sismos, tsunamis y erupciones significativos) · IBTrACS v04r01', generated: new Date().toISOString(), events: n }));
  console.log(`${n} eventos (${eqs.length} sismos, ${tss.length} tsunamis, ${vos.length} erupciones, ${cyc} ciclones cat. 5) en ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
