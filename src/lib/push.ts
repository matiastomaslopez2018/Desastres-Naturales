/*
 * Preferencias de las notificaciones push (compartidas entre la página y el servidor).
 */
import type { LiveAlert } from './alerts';

export type AlertKind = LiveAlert['kind'];
export const PUSH_KINDS: AlertKind[] = ['eq', 'tsunami', 'storm', 'ash', 'wx'];
/** Radios posibles para "solo cerca de un lugar" (km). */
export const PUSH_RADII = [300, 1000, 3000];

export type PushPrefs = {
  kinds: AlertKind[];
  /** Solo avisos a menos de `km` de este punto (redondeado a 0,1°); null = todos. */
  near: { lat: number; lon: number; km: number; name: string } | null;
};

export const DEFAULT_PREFS: PushPrefs = { kinds: [...PUSH_KINDS], near: null };

/** Limpia lo que llega del navegador. */
export function cleanPrefs(p: unknown): PushPrefs {
  const o = (p ?? {}) as Partial<PushPrefs>;
  const kinds = Array.isArray(o.kinds) ? PUSH_KINDS.filter((k) => o.kinds!.includes(k)) : [...PUSH_KINDS];
  const n = o.near;
  const near = n && Number.isFinite(n.lat) && Number.isFinite(n.lon) && Math.abs(n.lat) <= 90 && Math.abs(n.lon) <= 180
    ? { lat: Math.round(n.lat * 10) / 10, lon: Math.round(n.lon * 10) / 10, km: PUSH_RADII.includes(n.km) ? n.km : 1000, name: String(n.name ?? '').slice(0, 80) }
    : null;
  return { kinds: kinds.length ? kinds : [...PUSH_KINDS], near };
}

const R = 6371, rad = Math.PI / 180;
const km = (a: [number, number], b: [number, number]) => {
  const dLa = (b[1] - a[1]) * rad, dLo = (b[0] - a[0]) * rad;
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLo / 2) ** 2));
};

/** ¿Le corresponde este aviso a quien tiene estas preferencias? */
export function wants(p: PushPrefs, a: LiveAlert): boolean {
  if (!p.kinds.includes(a.kind)) return false;
  if (!p.near) return true;
  // Los mensajes de tsunami no traen posición: con filtro por lugar, solo las alertas (el nivel más alto).
  if (a.lon == null || a.lat == null) return a.kind === 'tsunami' && a.level === 'warning';
  // Alertas del SMN: cuenta la zona más cercana.
  const spots = a.spots?.length ? a.spots : [[a.lon, a.lat] as [number, number]];
  return spots.some((s) => km([p.near!.lon, p.near!.lat], s) <= p.near!.km);
}
