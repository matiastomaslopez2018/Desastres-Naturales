import { NextResponse, type NextRequest } from 'next/server';
import { kvCached } from '@/lib/server/kvCache';

export const dynamic = 'force-dynamic';

/*
 * Fechas para el "antes y después" de un evento con imágenes HLS (Harmonized Landsat Sentinel-2, NASA, 30 m):
 * se buscan las pasadas sobre el punto en el catálogo CMR STAC de la NASA (LP DAAC) y se elige la más reciente con
 * pocas nubes antes del inicio y la primera con pocas nubes después del fin (o, si no hay, la menos nublada).
 *   ?lon=&lat=&start=<ms>&end=<ms>
 */
type Pass = { date: string; coll: 'S30' | 'L30'; cloud: number };
const STAC = 'https://cmr.earthdata.nasa.gov/stac/LPCLOUD/search';
const CLEAR = 20;

async function passes(lon: number, lat: number, from: number, to: number): Promise<Pass[]> {
  if (to <= from) return [];
  const bbox = [lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02].map((x) => x.toFixed(4)).join(',');
  const dt = `${new Date(from).toISOString().slice(0, 19)}Z/${new Date(to).toISOString().slice(0, 19)}Z`;
  const out: Pass[] = [];
  let url: string | null = `${STAC}?collections=HLSS30_2.0,HLSL30_2.0&bbox=${bbox}&datetime=${dt}&limit=200`;
  for (let page = 0; url && page < 3; page++) {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`STAC ${r.status}`);
    const j = (await r.json()) as { features?: { collection: string; properties: { datetime: string; 'eo:cloud_cover'?: number } }[]; links?: { rel: string; href: string }[] };
    for (const f of j.features ?? []) {
      out.push({ date: f.properties.datetime.slice(0, 10), coll: f.collection.startsWith('HLSS30') ? 'S30' : 'L30', cloud: f.properties['eo:cloud_cover'] ?? 100 });
    }
    url = j.links?.find((l) => l.rel === 'next')?.href ?? null;
  }
  return out;
}

const pick = (list: Pass[], latest: boolean) => {
  const sorted = [...list].sort((a, b) => (latest ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  return sorted.find((p) => p.cloud <= CLEAR) ?? sorted.sort((a, b) => a.cloud - b.cloud)[0] ?? null;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lon = Number(sp.get('lon')), lat = Number(sp.get('lat')), start = Number(sp.get('start')), end = Number(sp.get('end') || sp.get('start'));
  if (![lon, lat, start, end].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return NextResponse.json({ error: 'params' }, { status: 400 });
  const day = 864e5, now = Date.now();
  try {
    // Se redondea a ~1 km y al día para compartir caché entre visitas; el "después" se renueva cada 6 horas.
    const key = `hls:v1:${lon.toFixed(2)}:${lat.toFixed(2)}:${Math.floor(start / day)}:${Math.floor(end / day)}`;
    const r = await kvCached(key, 6 * 3600_000, async () => ({
      before: pick(await passes(lon, lat, start - 60 * day, start - day / 2), true),
      after: pick(await passes(lon, lat, end, Math.min(now, end + 45 * day)), false),
    }));
    return NextResponse.json(r.value, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  } catch (err) {
    console.error('[sat-dates]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
