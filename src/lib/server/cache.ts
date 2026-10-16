import 'server-only';

type Entry<T> = { value: T; at: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Caché en memoria con TTL y deduplicación de pedidos concurrentes.
 * Solo para proxies en vivo (detalle de sismo, eventos sueltos); los datos
 * del mapa viven en la base (db.ts).
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = load()
    .then((value) => {
      store.set(key, { value, at: Date.now() });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const transient = (err: unknown) =>
  err instanceof HttpError ? err.status === 429 || err.status >= 502 : err instanceof TypeError || (err as Error)?.name === 'TimeoutError';

/** GET JSON con timeout; reintenta errores de red, 429 y 502–504 con espera creciente. */
export async function fetchJson<T = unknown>(url: string, timeoutMs = 25000, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': 'AtlasDeDesastres/0.1 (+https://github.com/)', Accept: 'application/json' },
      });
      if (!res.ok) throw new HttpError(res.status, `${res.status} ${res.statusText} — ${url}`);
      const text = await res.text();
      if (res.status === 204) throw new HttpError(204, `204 No Content — ${url}`);
      return (text.trim() ? JSON.parse(text) : {}) as T;
    } catch (err) {
      if (attempt >= retries || !transient(err)) throw err;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
  }
}
