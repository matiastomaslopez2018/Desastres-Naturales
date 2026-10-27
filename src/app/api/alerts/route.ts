import { NextResponse } from 'next/server';
import { getTsunamiMessages } from '@/lib/server/tsunami';
import { getActiveStorms } from '@/lib/server/nhc';
import { getOtherStorms } from '@/lib/server/gdacsStorms';
import { mapUsgs } from '@/lib/server/sources';
import { getLiveAsh } from '@/lib/server/volcanicAsh';
import type { LiveAlert } from '@/lib/alerts';
import { ALERT_RULES, alertWorthy, ashWorthy } from '@/lib/alerts';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/*
 * Eventos para los avisos en vivo de la página (cada visitante consulta cada minuto; la CDN guarda la
 * respuesta 60 s, así que la función corre como mucho una vez por minuto):
 *   - Sismos: feed en tiempo real del USGS (M4,5+ de la última hora, se actualiza cada minuto), con los
 *     umbrales de ALERT_RULES.
 *   - Tsunamis: avisos, alertas y vigilancias vigentes de los centros de la NOAA (NTWC y PTWC).
 *   - Ciclones activos: NHC y, en las otras cuencas, GDACS.
 *   - Ceniza volcánica: SIGMET de ceniza vigentes (Aviation Weather Center, NOAA), con los umbrales de
 *     ALERT_RULES. Un aviso por volcán: mientras siga la erupción no se repite (se recuerda 3 días).
 * Si una fuente falla, las otras igual se devuelven.
 */
export async function GET() {
  const [quakes, tsunami, storms, ash] = await Promise.all([
    fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_hour.geojson', { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { features?: Parameters<typeof mapUsgs>[0][] }) => (j.features ?? []).filter((f) => f.geometry).map(mapUsgs))
      .catch((e) => { console.warn('[alerts] usgs', e); return []; }),
    getTsunamiMessages().then((r) => r.active).catch((e) => { console.warn('[alerts] tsunami', e); return []; }),
    Promise.all([getActiveStorms().then((r) => r.storms).catch(() => []), getOtherStorms().then((r) => r.storms).catch(() => [])])
      .then(([a, b]) => { const names = new Set(a.map((s) => s.name.toLowerCase())); return [...a, ...b.filter((s) => !names.has(s.name.toLowerCase()))]; }),
    getLiveAsh().then((r) => r.active).catch((e) => { console.warn('[alerts] ash', e); return []; }),
  ]);

  const alerts: LiveAlert[] = [
    ...quakes.filter((e) => e.status !== 'deleted' && alertWorthy(e.mag, e.lon, e.lat)).map((e): LiveAlert => ({
      id: e.id, kind: 'eq', time: e.time, mag: e.mag, title: e.title, lon: e.lon, lat: e.lat, tsunami: !!e.tsunami, url: e.url,
    })),
    ...tsunami.map((m): LiveAlert => ({ id: m.id, kind: 'tsunami', time: m.issued, mag: m.magnitude, title: m.region, level: m.level, url: m.url })),
    // Las depresiones tropicales no avisan: se avisa cuando se forma una tormenta con nombre o más.
    ...storms.filter((s) => !/^(TD|STD|PTC|PC)$/.test(s.classification)).map((s): LiveAlert => ({ id: `storm-${s.id}`, kind: 'storm', time: s.lastUpdate, title: s.name, classification: s.classification, windKt: s.windKt, basinWord: s.basinWord })),
    ...ash.filter((a) => ashWorthy(a.topKm, a.lon, a.lat)).map((a): LiveAlert => ({ id: `ash-${a.gvp ?? a.name}`, kind: 'ash', time: a.issued, title: a.name, topKm: a.topKm, country: a.country, sim: a.sim, lon: a.lon, lat: a.lat })),
  ];
  return NextResponse.json({ alerts, rules: ALERT_RULES, at: Date.now() }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } });
}
