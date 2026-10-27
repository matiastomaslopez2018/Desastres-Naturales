/*
 * Avisos en vivo: qué eventos merecen avisar mientras alguien tiene la página abierta.
 * Sismos de M6+ en cualquier lugar (unos 15 por año en el mundo) y de M5+ en Argentina, Chile y los países
 * vecinos; avisos de tsunami de la NOAA; ciclones activos.
 */

export type LiveAlert = {
  id: string;
  kind: 'eq' | 'tsunami' | 'storm';
  time: number;
  title: string;
  mag?: number | null;
  lon?: number; lat?: number;
  /** Sismo: el USGS lo marca en zona oceánica (no confirma tsunami). */
  tsunami?: boolean;
  /** Tsunami: nivel del mensaje de la NOAA. */
  level?: string;
  /** Ciclón: clasificación (HU, TS…), viento (kt) y palabra según la cuenca. */
  classification?: string; windKt?: number | null; basinWord?: 'hurricane' | 'typhoon' | 'cyclone';
  url?: string;
};

export const ALERT_RULES = {
  /** Magnitud mínima en cualquier parte del mundo. */
  world: 6,
  /** Magnitud mínima en la región cercana. */
  region: 5,
  /** Argentina, Chile y vecinos (Bolivia, Paraguay, Uruguay, Perú y el sur de Brasil): [oeste, sur, este, norte]. */
  regionBox: [-82, -60, -34, 0] as [number, number, number, number],
};

export function alertWorthy(mag: number | null | undefined, lon: number, lat: number) {
  if (mag == null) return false;
  if (mag >= ALERT_RULES.world) return true;
  const [w, s, e, n] = ALERT_RULES.regionBox;
  return mag >= ALERT_RULES.region && lon >= w && lon <= e && lat >= s && lat <= n;
}
