import 'server-only';
import { getTsunamiMessages } from './tsunami';
import { getActiveStorms } from './nhc';
import { getOtherStorms } from './gdacsStorms';
import { mapUsgs } from './sources';
import { getLiveAsh } from './volcanicAsh';
import { getSmnAlerts } from './smn';
import type { LiveAlert } from '../alerts';
import { alertWorthy, ashWorthy } from '../alerts';

/*
 * Eventos para los avisos en vivo: los usa la página (/api/alerts) y las notificaciones push.
 *   - Sismos: feed en tiempo real del USGS (M4,5+ de la última hora, se actualiza cada minuto), con los
 *     umbrales de ALERT_RULES.
 *   - Tsunamis: avisos, alertas y vigilancias vigentes de los centros de la NOAA (NTWC y PTWC).
 *   - Ciclones activos: NHC y, en las otras cuencas, GDACS.
 *   - Ceniza volcánica: SIGMET de ceniza vigentes (Aviation Weather Center, NOAA), con los umbrales de
 *     ALERT_RULES. Un aviso por volcán: mientras siga la erupción no se repite (se recuerda 3 días).
 *   - Alertas del SMN (Argentina): las naranjas y rojas vigentes o que empiezan dentro de 24 horas. El SMN publica
 *     un archivo por zona: se agrupan por fenómeno, nivel e inicio, en un solo aviso.
 * Si una fuente falla, las otras igual se devuelven.
 */
export async function getLiveAlerts(): Promise<LiveAlert[]> {
  const [quakes, tsunami, storms, ash, smn] = await Promise.all([
    fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_hour.geojson', { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { features?: Parameters<typeof mapUsgs>[0][] }) => (j.features ?? []).filter((f) => f.geometry).map(mapUsgs))
      .catch((e) => { console.warn('[alerts] usgs', e); return []; }),
    getTsunamiMessages().then((r) => r.active).catch((e) => { console.warn('[alerts] tsunami', e); return []; }),
    Promise.all([getActiveStorms().then((r) => r.storms).catch(() => []), getOtherStorms().then((r) => r.storms).catch(() => [])])
      .then(([a, b]) => { const names = new Set(a.map((s) => s.name.toLowerCase())); return [...a, ...b.filter((s) => !names.has(s.name.toLowerCase()))]; }),
    getLiveAsh().then((r) => r.active).catch((e) => { console.warn('[alerts] ash', e); return []; }),
    getSmnAlerts().then((r) => r.alerts).catch((e) => { console.warn('[alerts] smn', e); return []; }),
  ]);

  const wx = new Map<string, LiveAlert>();
  const soon = Date.now() + 24 * 3600_000;
  for (const a of smn) {
    if (a.level === 'yellow' || a.onset > soon) continue;
    const id = `wx-${a.event}-${a.level}-${a.onset}`, x = wx.get(id);
    if (x) { x.spots!.push([a.lon, a.lat]); x.time = Math.max(x.time, a.sent); continue; }
    wx.set(id, { id, kind: 'wx', time: a.sent, title: a.event, level: a.level, onset: a.onset, expires: a.expires, spots: [[a.lon, a.lat]], lon: a.lon, lat: a.lat, url: 'https://www.smn.gob.ar/alertas' });
  }

  const alerts: LiveAlert[] = [
    ...quakes.filter((e) => e.status !== 'deleted' && alertWorthy(e.mag, e.lon, e.lat)).map((e): LiveAlert => ({
      id: e.id, kind: 'eq', time: e.time, mag: e.mag, title: e.title, lon: e.lon, lat: e.lat, tsunami: !!e.tsunami, url: e.url,
    })),
    ...tsunami.map((m): LiveAlert => ({ id: m.id, kind: 'tsunami', time: m.issued, mag: m.magnitude, title: m.region, level: m.level, url: m.url })),
    // Las depresiones tropicales no avisan: se avisa cuando se forma una tormenta con nombre o más.
    ...storms.filter((s) => !/^(TD|STD|PTC|PC)$/.test(s.classification)).map((s): LiveAlert => ({ id: `storm-${s.id}`, kind: 'storm', time: s.lastUpdate, title: s.name, classification: s.classification, windKt: s.windKt, basinWord: s.basinWord, lon: s.lon, lat: s.lat })),
    ...ash.filter((a) => ashWorthy(a.topKm, a.lon, a.lat)).map((a): LiveAlert => ({ id: `ash-${a.gvp ?? a.name}`, kind: 'ash', time: a.issued, title: a.name, topKm: a.topKm, country: a.country, sim: a.sim, lon: a.lon, lat: a.lat })),
    ...wx.values(),
  ];
  return alerts;
}
