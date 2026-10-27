/*
 * Avisos en vivo: qué eventos merecen avisar mientras alguien tiene la página abierta.
 * Sismos de M6+ en cualquier lugar (unos 15 por año en el mundo) y de M5+ en Argentina, Chile y los países
 * vecinos; avisos de tsunami de la NOAA; ciclones activos; nubes de ceniza volcánica de 10 km o más en el
 * mundo y de cualquier altura sobre la Argentina y Chile (SIGMET de ceniza).
 */

export type LiveAlert = {
  id: string;
  kind: 'eq' | 'tsunami' | 'storm' | 'ash';
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
  /** Ceniza: tope de la nube (km s. n. m.), país y volcán del simulador. */
  topKm?: number; country?: Record<'es' | 'en', string> | null; sim?: string | null;
  url?: string;
};

export const ALERT_RULES = {
  /** Magnitud mínima en cualquier parte del mundo. */
  world: 6,
  /** Magnitud mínima en la región cercana. */
  region: 5,
  /** Argentina, Chile y vecinos (Bolivia, Paraguay, Uruguay, Perú y el sur de Brasil): [oeste, sur, este, norte]. */
  regionBox: [-82, -60, -34, 0] as [number, number, number, number],
  /** Ceniza: tope mínimo de la nube en el mundo (km s. n. m.) y recuadro de la Argentina y Chile, donde avisa cualquier nube. */
  ashWorldKm: 10,
  ashBox: [-76, -56, -53, -17] as [number, number, number, number],
};

export function alertWorthy(mag: number | null | undefined, lon: number, lat: number) {
  if (mag == null) return false;
  if (mag >= ALERT_RULES.world) return true;
  const [w, s, e, n] = ALERT_RULES.regionBox;
  return mag >= ALERT_RULES.region && lon >= w && lon <= e && lat >= s && lat <= n;
}

export function ashWorthy(topKm: number, lon: number, lat: number) {
  if (topKm >= ALERT_RULES.ashWorldKm) return true;
  const [w, s, e, n] = ALERT_RULES.ashBox;
  return lon >= w && lon <= e && lat >= s && lat <= n;
}
