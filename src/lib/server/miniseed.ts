/*
 * Lector mínimo de miniSEED 2 (el formato de los registros sísmicos de las redes FDSN): encabezado fijo, blockette
 * 1000 y datos en enteros de 16 o 32 bits o comprimidos con Steim1 o Steim2 (los que usan las redes globales).
 * Une los registros de un mismo canal en una serie continua; los huecos se rellenan con el último valor.
 */

export type Trace = { start: number; sps: number; samples: Float64Array };

function rate(f: number, m: number) {
  if (f > 0) return m > 0 ? f * m : m < 0 ? -f / m : f;
  if (f < 0) return m > 0 ? -m / f : m < 0 ? 1 / (f * m) : -1 / f;
  return 0;
}

/** Diferencias de un bloque Steim (64 bytes por cuadro, 16 palabras de 32 bits; la palabra 0 son los códigos). */
function steim(dv: DataView, off: number, len: number, nsamp: number, v2: boolean) {
  const diffs: number[] = [];
  let x0 = 0;
  for (let f = off; f + 64 <= off + len && diffs.length < nsamp + 1; f += 64) {
    const codes = dv.getUint32(f);
    for (let w = 1; w < 16; w++) {
      const c = (codes >>> (30 - 2 * w)) & 3, word = dv.getUint32(f + 4 * w), o = f + 4 * w;
      if (f === off && w === 1) { x0 = dv.getInt32(o); continue; }
      if (f === off && w === 2) continue; // valor final (control)
      if (c === 0) continue;
      if (c === 1) { for (let k = 0; k < 4; k++) diffs.push(dv.getInt8(o + k)); continue; }
      if (!v2) {
        if (c === 2) { diffs.push(dv.getInt16(o), dv.getInt16(o + 2)); } else diffs.push(dv.getInt32(o));
        continue;
      }
      const dnib = word >>> 30;
      // Campos con signo de `bits` bits, de izquierda a derecha, dentro de los 30 bits bajos.
      const take = (n: number, bits: number) => {
        for (let k = n - 1; k >= 0; k--) {
          let v = (word >>> (k * bits)) & ((1 << bits) - 1);
          if (v & (1 << (bits - 1))) v -= 1 << bits;
          diffs.push(v);
        }
      };
      if (c === 2) { if (dnib === 1) take(1, 30); else if (dnib === 2) take(2, 15); else if (dnib === 3) take(3, 10); }
      else if (dnib === 0) take(5, 6); else if (dnib === 1) take(6, 5); else if (dnib === 2) take(7, 4);
    }
  }
  const out = new Float64Array(nsamp);
  if (!nsamp) return out;
  out[0] = x0;
  for (let i = 1; i < nsamp; i++) out[i] = out[i - 1] + (diffs[i] ?? 0);
  return out;
}

/** Decodifica todos los registros y los une en una serie (supone un solo canal). */
export function readMiniseed(buf: ArrayBuffer): Trace | null {
  const recs: { t: number; sps: number; s: Float64Array }[] = [];
  let pos = 0;
  while (pos + 64 <= buf.byteLength) {
    const dv = new DataView(buf, pos);
    const b1000 = dv.getUint16(46);
    if (!b1000 || dv.getUint16(b1000) !== 1000) break;
    const enc = dv.getUint8(b1000 + 4), recLen = 2 ** dv.getUint8(b1000 + 6);
    if (dv.getUint8(b1000 + 5) !== 1) throw new Error('miniSEED: solo big-endian');
    const year = dv.getUint16(20), doy = dv.getUint16(22);
    const t = Date.UTC(year, 0, doy, dv.getUint8(24), dv.getUint8(25), dv.getUint8(26)) + dv.getUint16(28) / 10;
    const nsamp = dv.getUint16(30), sps = rate(dv.getInt16(32), dv.getInt16(34)), dOff = dv.getUint16(44);
    const ddv = new DataView(buf, pos);
    let s: Float64Array;
    if (enc === 10 || enc === 11) s = steim(ddv, dOff, recLen - dOff, nsamp, enc === 11);
    else if (enc === 3) { s = new Float64Array(nsamp); for (let i = 0; i < nsamp; i++) s[i] = ddv.getInt32(dOff + 4 * i); }
    else if (enc === 1) { s = new Float64Array(nsamp); for (let i = 0; i < nsamp; i++) s[i] = ddv.getInt16(dOff + 2 * i); }
    else throw new Error(`miniSEED: codificación ${enc}`);
    if (nsamp && sps > 0) recs.push({ t, sps, s });
    pos += recLen;
  }
  if (!recs.length) return null;
  recs.sort((a, b) => a.t - b.t);
  const sps = recs[0].sps, start = recs[0].t, last = recs[recs.length - 1];
  const n = Math.round(((last.t - start) / 1000) * sps) + last.s.length;
  const out = new Float64Array(n);
  let filled = 0, prev = recs[0].s[0];
  for (const r of recs) {
    if (r.sps !== sps) continue;
    const i0 = Math.round(((r.t - start) / 1000) * sps);
    for (let i = filled; i < Math.min(i0, n); i++) out[i] = prev;
    for (let i = 0; i < r.s.length && i0 + i < n; i++) out[i0 + i] = r.s[i];
    filled = Math.max(filled, Math.min(n, i0 + r.s.length));
    prev = out[filled - 1];
  }
  return { start, sps, samples: out.subarray(0, filled) };
}
