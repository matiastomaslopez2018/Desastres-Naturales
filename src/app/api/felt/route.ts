import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { geoDistance } from 'd3-geo';
import { addFelt, feltReports, getStoredEvent, kvDeleteOlder, kvIncr } from '@/lib/server/db';
import { isEventId } from '@/lib/server/ingest';
import { FELT_BANDS, FELT_DAYS, FELT_MMI, type FeltSummary } from '@/lib/felt';

export const dynamic = 'force-dynamic';

/*
 * "¿Lo sentiste?" (reportes anónimos de cómo se sintió un sismo).
 *   GET  ?id=<evento>                      → resumen: cantidad por nivel y por distancia al epicentro.
 *   POST { id, level 0–6, lat?, lon? }      → guarda un reporte (ubicación redondeada a 0,1°, ~10 km).
 * No se guarda la IP: solo un hash con sal del día para limitar a un reporte por sismo y 30 por hora.
 */

async function summary(id: string): Promise<FeltSummary> {
  const [rows, e] = await Promise.all([feltReports(id), getStoredEvent(id)]);
  const byLevel = [0, 0, 0, 0, 0, 0, 0];
  const acc = FELT_BANDS.map((maxKm) => ({ maxKm, n: 0, sum: 0 }));
  let located = 0;
  for (const r of rows) {
    byLevel[r.level]++;
    if (!e || r.lat == null || r.lon == null || r.level === 0) continue;
    located++;
    const km = geoDistance([e.lon, e.lat], [r.lon, r.lat]) * 6371, b = acc.find((x) => km <= x.maxKm)!;
    b.n++; b.sum += FELT_MMI[r.level];
  }
  return { total: rows.length, byLevel, located, bands: acc.map((b) => ({ maxKm: b.maxKm, n: b.n, mmi: b.n ? b.sum / b.n : null })) };
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!isEventId(id)) return NextResponse.json({ error: 'id' }, { status: 400 });
  return NextResponse.json(await summary(id), { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { id?: string; level?: number; lat?: number | null; lon?: number | null } | null;
  const id = b?.id ?? '', level = Number(b?.level);
  if (!isEventId(id) || !Number.isInteger(level) || level < 0 || level > 6) return NextResponse.json({ error: 'bad' }, { status: 400 });
  const e = await getStoredEvent(id);
  if (!e || e.type !== 'eq') return NextResponse.json({ error: 'event' }, { status: 404 });
  if (Date.now() - e.time > FELT_DAYS * 864e5) return NextResponse.json({ error: 'closed' }, { status: 410 });
  const lat = Number(b?.lat), lon = Number(b?.lon), hasLoc = b?.lat != null && b?.lon != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

  // Límite: un reporte por sismo y 30 por hora desde la misma conexión (hash con sal del día; la IP no se guarda).
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  const day = new Date().toISOString().slice(0, 10), h = createHash('sha256').update(`${day}|${ip}|${process.env.FELT_SALT ?? 'mapa-de-desastres'}`).digest('hex').slice(0, 24);
  const hour = Math.floor(Date.now() / 36e5);
  if ((await kvIncr(`felt:rl:${h}:${id}`)) > 1) return NextResponse.json({ error: 'already' }, { status: 409 });
  if ((await kvIncr(`felt:rl:${h}:h${hour}`)) > 30) return NextResponse.json({ error: 'rate' }, { status: 429 });
  kvDeleteOlder('felt:rl:', Date.now() - FELT_DAYS * 864e5).catch(() => {});

  await addFelt(id, level, hasLoc ? Math.round(lat * 10) / 10 : null, hasLoc ? Math.round(lon * 10) / 10 : null);
  return NextResponse.json(await summary(id));
}
