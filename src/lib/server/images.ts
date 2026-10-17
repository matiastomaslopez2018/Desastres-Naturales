import 'server-only';
import { inflateSync } from 'node:zlib';
import { geoBounds, geoDistance } from 'd3-geo';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import { fetchJson } from './cache';
import { countryShape } from './countries';
import { getEventById, getGvp } from './ingest';
import { kvCached } from './kvCache';
import { getActiveStorms } from './nhc';
import { decodeEntities, fetchUsgsDetail } from './sources';
import { alertLevel } from '../symbols';
import type { DisasterEvent, GvpVolcano, MediaImage, NhcStorm } from '../types';

/*
 * Imágenes de las fichas (evento, volcán, ciclón, país). Solo fuentes públicas u oficiales,
 * siempre con crédito y licencia. Orden: artículo de NASA Earth Observatory (eventos grandes),
 * imagen propia del tipo (ShakeMap, foto de Commons, GOES) y, siempre al final, la satelital
 * de NASA GIBS, que existe para cualquier lugar y fecha. El resultado se guarda en la base.
 */

countries.registerLocale(en);

const UA = 'AtlasDeDesastres/1.0 (https://desastres-naturales-rho.vercel.app)';
const DAY = 864e5;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const stripHtml = (s = '') => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

async function fetchBuf(url: string, timeoutMs = 20000): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/* ───────────── NASA GIBS (WMS, sin clave) ───────────── */

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const TRUE_COLOR = [
  { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', name: 'MODIS (Terra)' },
  { id: 'MODIS_Aqua_CorrectedReflectance_TrueColor', name: 'MODIS (Aqua)' },
  { id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', name: 'VIIRS (Suomi NPP)' },
];
const FIRES = 'VIIRS_SNPP_Thermal_Anomalies_375m_All';

type Box = { s: number; w: number; n: number; e: number };

/** Recuadro de alto 2·latHalf centrado en el punto, con proporción 16:9 en el terreno. */
function boxAround(lat: number, lon: number, latHalf: number): Box {
  const lonHalf = Math.min(179, (latHalf * 16) / 9 / Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  let s = lat - latHalf, n = lat + latHalf;
  if (s < -90) { n += -90 - s; s = -90; }
  if (n > 90) { s -= n - 90; n = 90; }
  // WMS en EPSG:4326 no cruza el antimeridiano: se corre el recuadro para que entre.
  let w = lon - lonHalf, e = lon + lonHalf;
  if (w < -180) { e += -180 - w; w = -180; }
  if (e > 180) { w -= e - 180; e = 180; }
  return { s, w: Math.max(-180, w), n, e: Math.min(180, e) };
}

const wms = (layers: string, b: Box, width: number, height: number, date?: string, format = 'image/jpeg') =>
  `${GIBS_WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layers}&CRS=EPSG:4326` +
  `&BBOX=${b.s.toFixed(3)},${b.w.toFixed(3)},${b.n.toFixed(3)},${b.e.toFixed(3)}&WIDTH=${width}&HEIGHT=${height}` +
  `&FORMAT=${encodeURIComponent(format)}${date ? `&TIME=${date}` : ''}`;

const worldview = (layers: string, b: Box, date?: string) =>
  `https://worldview.earthdata.nasa.gov/?v=${b.w.toFixed(2)},${b.s.toFixed(2)},${b.e.toFixed(2)},${b.n.toFixed(2)}&l=${layers}${date ? `&t=${date}-T12:00:00Z` : ''}`;

/** Decodifica un PNG RGB/RGBA de 8 bits (solo lo necesario para contar píxeles). */
function pngPixels(buf: Buffer): { px: Buffer; bpp: number; n: number } | null {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat: Buffer[] = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (ctype !== 6 && ctype !== 2)) return null;
  const bpp = ctype === 6 ? 4 : 3, stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], o = y * (stride + 1) + 1, r0 = y * stride, p0 = (y - 1) * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[r0 + i - bpp] : 0, b = y ? px[p0 + i] : 0, c = y && i >= bpp ? px[p0 + i - bpp] : 0;
      let v = raw[o + i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[r0 + i] = v & 255;
    }
  }
  return { px, bpp, n: w * h };
}

/**
 * Qué tan "inútil" es una imagen: fracción de píxeles nublados (claros y sin color) más
 * fracción sin datos (franjas entre pasadas del satélite). 0 = despejada, 1 = nada visible.
 * Solo sirve para elegir entre fechas y satélites; no se muestra como dato.
 */
async function obstruction(layer: string, b: Box, date: string): Promise<number> {
  const buf = await fetchBuf(wms(layer, b, 64, 36, date, 'image/png'), 15000);
  const img = buf && (() => { try { return pngPixels(buf); } catch { return null; } })();
  if (!img) return 1;
  const { px, bpp, n } = img;
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const r = px[i * bpp], g = px[i * bpp + 1], bl = px[i * bpp + 2], al = bpp === 4 ? px[i * bpp + 3] : 255;
    if (al < 128 || r + g + bl < 12) { bad++; continue; }
    const mn = Math.min(r, g, bl), mx = Math.max(r, g, bl);
    if (mn > 165 && mx - mn < 40) bad++;
  }
  return bad / n;
}

type Pick = { layer: (typeof TRUE_COLOR)[number]; date: string; score: number };

async function clearest(b: Box, dates: string[], layers = TRUE_COLOR): Promise<Pick | null> {
  const tries = dates.flatMap((date) => layers.map((layer) => ({ layer, date })));
  const scored = await Promise.all(tries.map(async (t) => ({ ...t, score: await obstruction(t.layer.id, b, t.date) })));
  // Gana la fecha más temprana de la lista salvo que otra sea claramente mejor.
  let best: Pick | null = null;
  for (const date of dates) {
    const day = scored.filter((s) => s.date === date).sort((x, y) => x.score - y.score)[0];
    if (day && (!best || day.score < best.score - 0.15)) best = day;
  }
  return best && best.score < 0.97 ? best : null;
}

const SIZE: Record<string, number> = { eq: 0.8, fire: 0.3, volcano: 0.2, flood: 0.8, drought: 2.5, storm: 5, wvolc: 0.2, gvp: 0.2, nhc: 5 };

/**
 * Imagen satelital en color real del lugar: el día de referencia o el siguiente si está nublado.
 * `beforeFrom`: además busca una imagen 1–3 semanas antes para el deslizador antes/después.
 */
async function gibsImage(lat: number, lon: number, type: string, day: number, opts: { beforeFrom?: number; fires?: boolean; title: string }): Promise<MediaImage | null> {
  const today = Date.now() - 6 * 36e5; // la imagen del día tarda unas horas en completarse
  const b = boxAround(lat, lon, SIZE[type] ?? 1);
  const d0 = Math.min(day, today);
  const dates = [iso(d0), ...(d0 + DAY <= today ? [iso(d0 + DAY)] : [iso(d0 - DAY)])];
  const [main, before] = await Promise.all([
    clearest(b, dates),
    opts.beforeFrom != null
      ? clearest(b, [7, 14, 21].map((k) => iso(opts.beforeFrom! - k * DAY)), TRUE_COLOR.slice(0, 1))
      : Promise.resolve(null),
  ]);
  const pick = main ?? { layer: TRUE_COLOR[0], date: dates[0], score: 1 };
  const layers = opts.fires ? `${pick.layer.id},${FIRES}` : pick.layer.id;
  return {
    kind: 'gibs',
    src: wms(layers, b, 960, 540, pick.date), srcSmall: wms(layers, b, 640, 360, pick.date), width: 960, height: 540,
    alt: `${opts.title} — ${pick.layer.name}, ${pick.date}`,
    credit: "NASA GIBS / Worldview", licenseKind: 'nasa',
    sourceUrl: worldview(layers, b, pick.date), sourceLabel: 'NASA Worldview',
    date: pick.date, detail: pick.layer.name, fires: !!opts.fires,
    before: before && before.score < 0.5 ? {
      src: wms(before.layer.id, b, 960, 540, before.date), srcSmall: wms(before.layer.id, b, 640, 360, before.date),
      date: before.date, detail: before.layer.name,
    } : undefined,
  };
}

/** Relieve de Blue Marble (NASA), sin fecha: para países, donde una sola pasada casi siempre tiene nubes. */
function blueMarble(box: Box, title: string): MediaImage {
  const layer = 'BlueMarble_ShadedRelief_Bathymetry';
  const k = Math.cos((((box.n + box.s) / 2) * Math.PI) / 180) || 1;
  // Países angostos (Chile): se ensancha el recuadro para no generar una imagen muy alta.
  const MAX = 0.75;
  const b = { ...box };
  if ((b.n - b.s) / ((b.e - b.w) * k) > MAX) {
    const half = (b.n - b.s) / MAX / k / 2, c = (b.e + b.w) / 2;
    b.w = Math.max(-180, c - half); b.e = Math.min(180, c + half);
  }
  const ratio = Math.max(0.35, Math.min(MAX, (b.n - b.s) / ((b.e - b.w) * k)));
  const h = Math.round(960 * ratio);
  return {
    kind: 'gibs', src: wms(layer, b, 960, h), srcSmall: wms(layer, b, 640, Math.round(640 * ratio)), width: 960, height: h,
    alt: `${title} — NASA Blue Marble`, credit: 'NASA GIBS · Blue Marble (relieve sombreado)', licenseKind: 'nasa',
    sourceUrl: worldview(layer, b), sourceLabel: 'NASA Worldview', detail: 'Blue Marble',
  };
}

/* ───────────── USGS ShakeMap ───────────── */

/** Ancho y alto de un JPEG (marcador SOF). */
function jpegSize(buf: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

type Contents = Record<string, { url: string }>;

async function shakemap(e: DisasterEvent): Promise<MediaImage | null> {
  if (e.type !== 'eq' || e.src !== 'USGS') return null;
  const j = await fetchUsgsDetail(e.id).catch(() => null);
  const products = (j?.properties as { products?: Record<string, { contents?: Contents }[]> } | undefined)?.products;
  const url = products?.shakemap?.[0]?.contents?.['download/intensity.jpg']?.url;
  if (!url) return null;
  const buf = await fetchBuf(url);
  const size = buf ? jpegSize(buf) : null;
  return {
    kind: 'shakemap', src: url, ...(size ?? {}),
    alt: `USGS ShakeMap — ${e.title}`, credit: 'USGS ShakeMap', licenseKind: 'usgs',
    sourceUrl: `${e.url ?? `https://earthquake.usgs.gov/earthquakes/eventpage/${e.id}`}/shakemap/intensity`, sourceLabel: 'USGS',
  };
}

/* ───────────── Wikidata + Wikimedia Commons ───────────── */

async function wikidataImage(where: string): Promise<string | null> {
  const q = `SELECT ?img WHERE { ${where} ?item wdt:P18 ?img } LIMIT 1`;
  const j = await fetchJson<{ results: { bindings: { img: { value: string } }[] } }>(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, 20000, 1,
  ).catch(() => null);
  return j?.results.bindings[0]?.img.value ?? null;
}

type CommonsInfo = {
  thumburl?: string; thumbwidth?: number; thumbheight?: number; url: string; width: number; height: number; mime?: string; descriptionurl: string;
  extmetadata?: Record<string, { value: string }>;
};

/** Archivo de Commons con autor y licencia tal como vienen; sin alguno de los dos, no se usa. */
async function commons(filePathUrl: string, fallbackAlt: string): Promise<MediaImage | null> {
  const name = decodeURIComponent(filePathUrl.split('/Special:FilePath/')[1] ?? '');
  if (!name || /\.(svg|tiff?|pdf)$/i.test(name)) return null;
  const api = (w: number) => `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + name)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${w}&format=json&formatversion=2`;
  const [big, small] = await Promise.all([
    fetchJson<{ query: { pages: { imageinfo?: CommonsInfo[] }[] } }>(api(960), 20000, 1).catch(() => null),
    fetchJson<{ query: { pages: { imageinfo?: CommonsInfo[] }[] } }>(api(640), 20000, 1).catch(() => null),
  ]);
  const ii = big?.query.pages[0]?.imageinfo?.[0];
  const m = ii?.extmetadata ?? {};
  const artist = stripHtml(m.Artist?.value);
  const license = stripHtml(m.LicenseShortName?.value);
  if (!ii || !artist || !license) return null;
  const desc = stripHtml(m.ImageDescription?.value).slice(0, 200);
  const sm = small?.query.pages[0]?.imageinfo?.[0];
  return {
    kind: 'commons', src: ii.thumburl ?? ii.url, srcSmall: sm?.thumburl,
    width: ii.thumbwidth ?? ii.width, height: ii.thumbheight ?? ii.height,
    alt: desc || fallbackAlt, credit: artist, license, licenseUrl: m.LicenseUrl?.value || undefined,
    sourceUrl: ii.descriptionurl, sourceLabel: 'Wikimedia Commons',
  };
}

const volcanoPhoto = async (v: GvpVolcano) => {
  const f = await wikidataImage(`?item wdt:P1886 "${v.num}" .`);
  return f ? commons(f, v.title) : null;
};

/* ───────────── NOAA GOES (ciclones activos de NHC) ───────────── */

async function goes(st: NhcStorm): Promise<MediaImage | null> {
  const id = st.id.replace(/^nhc-/, '').toUpperCase();
  const base = `https://cdn.star.nesdis.noaa.gov/FLOATER/data/${id}/GEOCOLOR`;
  const r = await fetch(`${base}/500x500.jpg`, { method: 'HEAD', signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!r?.ok) return null;
  return {
    kind: 'goes', src: `${base}/1000x1000.jpg`, srcSmall: `${base}/500x500.jpg`, width: 1000, height: 1000,
    alt: `GOES GeoColor — ${st.name}`, credit: 'NOAA/NESDIS STAR · GOES GeoColor', licenseKind: 'noaa',
    sourceUrl: `https://www.star.nesdis.noaa.gov/goes/floater.php?stormid=${id}`, sourceLabel: 'NOAA STAR', live: true,
  };
}

/* ───────────── NASA Earth Observatory ───────────── */

type WpPost = {
  title: { rendered: string }; link: string; date: string; content?: { rendered: string }; excerpt?: { rendered: string };
  _embedded?: { 'wp:featuredmedia'?: { source_url: string; alt_text?: string; media_details?: { width?: number; height?: number; sizes?: Record<string, { source_url: string; width: number; height: number }> } }[] };
};

/** Imágenes con derechos de terceros (satélites comerciales, ESA) no se usan: la licencia no sería la de NASA. */
const THIRD_PARTY = /©|copyright|\bPlanet\b|\bMaxar\b|\bAirbus\b|\bSentinel\b|\bESA\b/i;

/**
 * Artículo de Earth Observatory sobre el evento: título que nombra al evento (o al país) y,
 * si se pide, una palabra del tipo de desastre; publicado entre `from` y `to`.
 */
async function earthObservatory(term: string, kind: RegExp | null, from: number, to: number): Promise<MediaImage | null> {
  if (!term || term.length < 3) return null;
  const url = `https://science.nasa.gov/wp-json/wp/v2/posts?search=${encodeURIComponent(term)}&after=${new Date(from).toISOString()}&before=${new Date(to).toISOString()}&per_page=10&_fields=title,link,date,content,excerpt,_links,_embedded&_embed=wp:featuredmedia`;
  const posts = await fetchJson<WpPost[]>(url, 20000, 1).catch(() => null);
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  for (const p of posts ?? []) {
    const title = stripHtml(p.title.rendered);
    if (!p.link.includes('/earth-observatory/') || !re.test(title)) continue;
    if (kind && !kind.test(`${title} ${stripHtml(p.excerpt?.rendered)}`)) continue;
    const content = p.content?.rendered ?? '';
    // Crédito de la imagen tal como lo escribe EO ("NASA Earth Observatory image by …").
    const credit = stripHtml(/NASA Earth Observatory (?:images?|photographs?|maps?|animation)[^<]{0,240}/i.exec(content)?.[0] ?? '');
    if (!credit || THIRD_PARTY.test(credit)) continue;
    const media = p._embedded?.['wp:featuredmedia']?.[0];
    if (!media?.source_url) continue;
    const s = media.media_details?.sizes ?? {};
    const big = s.large ?? s['1536x1536'] ?? s.full;
    const small = s.medium_large ?? s['card-lg'];
    return {
      kind: 'eo', src: big?.source_url ?? media.source_url, srcSmall: small?.source_url,
      width: big?.width ?? media.media_details?.width, height: big?.height ?? media.media_details?.height,
      alt: media.alt_text || title, credit: credit.replace(/\.$/, ''), licenseKind: 'nasa',
      sourceUrl: p.link, sourceLabel: 'NASA Earth Observatory', date: p.date.slice(0, 10), detail: title,
    };
  }
  return null;
}

const KIND_WORDS: Record<string, RegExp> = {
  eq: /earthquake|quake|tsunami/i, fire: /fire|burn|blaze|smoke/i, flood: /flood|rain|deluge/i, drought: /drought|dry/i,
};
const STORM_WORDS = /^(super\s+)?(hurricane|typhoon|cyclone|tropical|storm|depression|subtropical|post-tropical|potential|severe)\s+/i;
const stormName = (title: string) => {
  let t = title.trim();
  while (STORM_WORDS.test(t)) t = t.replace(STORM_WORDS, '');
  return /^[A-Za-z-]{3,}$/.test(t) ? t : '';
};

/* ───────────── Por tipo de ficha ───────────── */

const ttlFor = (day: number) => (Date.now() - day < 3 * DAY ? 3 * 36e5 : 30 * DAY);
const keep = (xs: (MediaImage | null | undefined)[]) => xs.filter((x): x is MediaImage => !!x);
const nearestVolcano = async (lat: number, lon: number) => {
  const list = await getGvp().catch(() => [] as GvpVolcano[]);
  let best: { v: GvpVolcano; km: number } | null = null;
  for (const v of list) {
    const km = geoDistance([v.lon, v.lat], [lon, lat]) * 6371;
    if (km < 30 && (!best || km < best.km)) best = { v, km };
  }
  return best?.v ?? null;
};

export async function imagesForEvent(id: string): Promise<MediaImage[] | null> {
  const found = await getEventById(id).catch(() => null);
  if (!found) return null;
  const e = found.event;
  const day = e.time;
  const r = await kvCached(`img3:event:${id}`, ttlFor(day), async () => {
    const big = alertLevel(e) >= 2 || (e.type === 'eq' && (e.mag ?? 0) >= 6) || e.type === 'storm' || e.type === 'volcano';
    const volcano = e.type === 'volcano' ? await nearestVolcano(e.lat, e.lon) : null;
    const storm = e.type === 'storm' ? stormName(e.title) : '';
    const nhc = storm ? (await getActiveStorms().catch(() => null))?.storms.find((s) =>
      s.name.toLowerCase() === storm.toLowerCase() && geoDistance([s.lon, s.lat], [e.lon, e.lat]) * 6371 < 1500) : undefined;
    const country = e.iso3 ? countries.getName(e.iso3, 'en') ?? '' : '';
    const eoTerm = storm || volcano?.title || country;
    const [eo, own, sat] = await Promise.all([
      big && eoTerm ? earthObservatory(eoTerm, storm || volcano ? null : KIND_WORDS[e.type] ?? null, (e.start ?? e.time) - 2 * DAY, (e.end ?? e.time) + 45 * DAY) : null,
      e.type === 'eq' ? shakemap(e) : volcano ? volcanoPhoto(volcano) : nhc ? goes(nhc) : null,
      gibsImage(e.lat, e.lon, e.type, day, {
        title: e.title, fires: e.type === 'fire',
        // Antes/después: donde el cambio se ve desde el satélite (no en sismos).
        beforeFrom: e.type === 'eq' ? undefined : e.start ?? e.time,
      }),
    ]);
    return keep([eo, own, sat]);
  });
  return r.value;
}

export async function imagesForVolcano(vn: number): Promise<MediaImage[] | null> {
  const v = (await getGvp().catch(() => [] as GvpVolcano[])).find((x) => x.num === vn);
  if (!v) return null;
  const r = await kvCached(`img3:volcano:${vn}`, 7 * DAY, async () => {
    const [photo, sat] = await Promise.all([volcanoPhoto(v), gibsImage(v.lat, v.lon, 'gvp', Date.now() - DAY, { title: v.title })]);
    return keep([photo, sat]);
  });
  return r.value;
}

export async function imagesForStorm(id: string): Promise<MediaImage[] | null> {
  const st = (await getActiveStorms()).storms.find((s) => s.id === id);
  if (!st) return null;
  const r = await kvCached(`img3:nhc:${id}`, 36e5, async () => {
    const [eo, img, sat] = await Promise.all([
      earthObservatory(st.name, null, Date.now() - 20 * DAY, Date.now() + DAY),
      goes(st),
      gibsImage(st.lat, st.lon, 'nhc', st.lastUpdate, { title: st.name }),
    ]);
    return keep([eo, img, sat]);
  });
  return r.value;
}

export async function imagesForCountry(iso3: string): Promise<MediaImage[] | null> {
  const shape = countryShape(iso3);
  if (!shape) return null;
  const r = await kvCached(`img3:country:${iso3}`, 30 * DAY, async () => {
    const name = countries.getName(iso3, 'en') ?? iso3;
    const f = await wikidataImage(`?item wdt:P298 "${iso3}" .`);
    const photo = f ? await commons(f, name) : null;
    const [[x0, y0], [x1, y1]] = geoBounds({ type: 'FeatureCollection', features: shape.features });
    const [cx, cy] = shape.centroid;
    // Países que cruzan el antimeridiano o muy extensos: recuadro alrededor del centroide.
    const b = x0 > x1 || x1 - x0 > 70
      ? boxAround(cy, cx, Math.min(18, Math.max(4, (y1 - y0) / 2)))
      : (() => { const px = (x1 - x0) * 0.08 + 0.5, py = (y1 - y0) * 0.08 + 0.5; return { s: Math.max(-90, y0 - py), n: Math.min(90, y1 + py), w: Math.max(-180, x0 - px), e: Math.min(180, x1 + px) }; })();
    return keep([photo, blueMarble(b, name)]);
  });
  return r.value;
}
