/* Enlace "Simular este sismo" desde un evento real del mapa. */
import { routePath } from '../seo';
import { localTitle } from '../localize';
import type { DisasterEvent, Lang } from '../types';

/**
 * Ruta del simulador con la magnitud y la profundidad del sismo. El ambiente se infiere solo por la
 * profundidad (más de 60 km: dentro de la placa que se hunde); el usuario puede cambiarlo. Lugar a 30 km.
 */
export function simHref(lang: Lang, e: DisasterEvent): string | null {
  if (e.type !== 'eq' || e.mag == null || e.mag < 4 || e.depth == null) return null;
  const depth = Math.max(1, Math.min(300, Math.round(e.depth)));
  const q = new URLSearchParams({
    m: e.mag.toFixed(1), h: String(depth), d: '30', amb: depth > 60 ? 'slab' : 'crustal', t: localTitle(e, lang),
  });
  return `${routePath(lang, 'simulator')}?${q}`;
}
