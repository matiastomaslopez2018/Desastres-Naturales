import 'server-only';
import { cached } from './cache';
import { kvGet, kvSet } from './db';

/**
 * Caché persistente en la base (tabla kv) con TTL: sirve para fuentes que cambian poco o
 * son caras de pedir (FIRMS, NCEI, NHC) y así no se piden de nuevo en cada instancia.
 * Si la fuente falla y hay un valor viejo, se devuelve el viejo con `stale: true`.
 */
export async function kvCached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<{ value: T; at: number; stale: boolean }> {
  return cached(`kv:${key}`, Math.min(ttlMs, 60_000), async () => {
    const hit = await kvGet<T>(key).catch(() => null);
    if (hit && Date.now() - hit.updatedAt < ttlMs) return { value: hit.value, at: hit.updatedAt, stale: false };
    try {
      const value = await load();
      await kvSet(key, value).catch(() => {});
      return { value, at: Date.now(), stale: false };
    } catch (err) {
      if (hit) return { value: hit.value, at: hit.updatedAt, stale: true };
      throw err;
    }
  });
}
