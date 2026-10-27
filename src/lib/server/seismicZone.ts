import 'server-only';
import { kvCached } from './kvCache';

/*
 * Zona sísmica oficial de un punto de la Argentina, según el Reglamento INPRES-CIRSOC 103 (construcciones
 * sismorresistentes). Se consulta la herramienta del INPRES "Determinar zona sísmica según coordenadas
 * geográficas" (http://contenidos.inpres.gob.ar/zonas), que devuelve la zona (0 a 4) y, de la 1 a la 4, la
 * aceleración máxima del suelo de diseño (aₛ, en fracción de g). La zonificación no cambia: un año de caché.
 */

export type SeismicZone = { zone: 0 | 1 | 2 | 3 | 4; as: number | null };

const URL_ZONES = 'http://contenidos.inpres.gob.ar/zonas_result.php';
const UA = 'Mozilla/5.0 (compatible; MapaDeDesastres/1.0; +https://desastres-naturales-rho.vercel.app)';

/** Texto del resultado → zona (null si el punto está fuera del territorio nacional). */
export function parseZone(html: string): SeismicZone | null {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  if (/no corresponden al territorio nacional/i.test(text)) return null;
  const z = /Zona s[ií]smica\s*"?([0-4])"?/i.exec(text);
  if (!z) throw new Error('INPRES: respuesta sin zona');
  const a = /a\s*s\s*=\s*(\d+,\d+)/.exec(text);
  return { zone: +z[1] as SeismicZone['zone'], as: a ? Number(a[1].replace(',', '.')) : null };
}

/** Zona del punto (redondeado a 0,01°, ~1 km). La herramienta pide latitud sur y longitud oeste en positivo. */
export async function seismicZone(lat: number, lon: number): Promise<SeismicZone | null> {
  const la = Math.round(lat * 100) / 100, lo = Math.round(lon * 100) / 100;
  if (la >= 0 || lo >= 0) return null;
  const r = await kvCached(`inpres:zone:v1:${la}:${lo}`, 365 * 24 * 36e5, async () => {
    const res = await fetch(URL_ZONES, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ latitud: String(-la), longitud: String(-lo) }),
    });
    if (!res.ok) throw new Error(`INPRES: HTTP ${res.status}`);
    // Se guarda también "fuera del país" (como objeto, para distinguirlo de un error).
    return { z: parseZone(await res.text()) };
  });
  return r.value.z;
}
