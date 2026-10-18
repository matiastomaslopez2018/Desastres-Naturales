import { deflateSync, inflateSync } from 'node:zlib';

/*
 * PNG mínimo (sin dependencias) para los rásteres del mapa: decodifica PNG de 8 bits (gris,
 * gris+alfa, RGB, RGBA o paleta) y codifica con paleta indexada (con transparencia) o RGBA.
 * Lo usan los scripts (GEM) y las rutas que recolorean imágenes oficiales (LHASA, FWI).
 */

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type: string, data: Uint8Array) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function ihdr(w: number, h: number, colorType: number) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(w, 0); b.writeUInt32BE(h, 4);
  b[8] = 8; b[9] = colorType; b[10] = 0; b[11] = 0; b[12] = 0;
  return chunk('IHDR', b);
}

/** Filas con filtro 0 (sin filtro): con paletas y zonas transparentes comprime bien igual. */
function idat(rows: Uint8Array, w: number, h: number, bpp: number) {
  const stride = w * bpp;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rows.buffer, rows.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  return chunk('IDAT', deflateSync(raw, { level: 9 }));
}

/** PNG con paleta: `index` es un byte por píxel; la paleta lleva RGBA (la transparencia va en tRNS). */
export function encodeIndexed(w: number, h: number, index: Uint8Array, palette: [number, number, number, number][]): Buffer {
  const plte = Buffer.alloc(palette.length * 3), trns = Buffer.alloc(palette.length);
  palette.forEach(([r, g, b, a], i) => { plte[i * 3] = r; plte[i * 3 + 1] = g; plte[i * 3 + 2] = b; trns[i] = a; });
  return Buffer.concat([SIG, ihdr(w, h, 3), chunk('PLTE', plte), chunk('tRNS', trns), idat(index, w, h, 1), chunk('IEND', Buffer.alloc(0))]);
}

export function encodeRGBA(w: number, h: number, rgba: Uint8Array): Buffer {
  return Buffer.concat([SIG, ihdr(w, h, 6), idat(rgba, w, h, 4), chunk('IEND', Buffer.alloc(0))]);
}

/** Decodifica un PNG de 8 bits a RGBA. Lanza si el formato no está soportado (16 bits, entrelazado). */
export function decodePng(buf: Uint8Array): { width: number; height: number; data: Uint8Array } {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (!b.subarray(0, 8).equals(SIG)) throw new Error('no es PNG');
  let o = 8, w = 0, h = 0, depth = 0, ct = 0, interlace = 0;
  let plte: Buffer | null = null, trns: Buffer | null = null;
  const parts: Buffer[] = [];
  while (o < b.length) {
    const n = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + n);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ct = d[9]; interlace = d[12]; }
    else if (type === 'PLTE') plte = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') parts.push(d);
    else if (type === 'IEND') break;
    o += 12 + n;
  }
  if (depth !== 8 || interlace) throw new Error(`PNG no soportado (bits ${depth}, entrelazado ${interlace})`);
  const bpp = ct === 0 ? 1 : ct === 2 ? 3 : ct === 3 ? 1 : ct === 4 ? 2 : 4;
  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(parts));
  const px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = raw[src + x], l = x >= bpp ? px[dst + x - bpp] : 0, u = y ? px[dst - stride + x] : 0, ul = y && x >= bpp ? px[dst - stride + x - bpp] : 0;
      let v = a;
      if (f === 1) v += l;
      else if (f === 2) v += u;
      else if (f === 3) v += (l + u) >> 1;
      else if (f === 4) { const p = l + u - ul, pa = Math.abs(p - l), pb = Math.abs(p - u), pc = Math.abs(p - ul); v += pa <= pb && pa <= pc ? l : pb <= pc ? u : ul; }
      px[dst + x] = v & 255;
    }
  }
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * bpp, d = i * 4;
    if (ct === 0) { out[d] = out[d + 1] = out[d + 2] = px[s]; out[d + 3] = 255; }
    else if (ct === 4) { out[d] = out[d + 1] = out[d + 2] = px[s]; out[d + 3] = px[s + 1]; }
    else if (ct === 2) { out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = 255; }
    else if (ct === 6) { out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = px[s + 3]; }
    else { const k = px[s]; out[d] = plte?.[k * 3] ?? 0; out[d + 1] = plte?.[k * 3 + 1] ?? 0; out[d + 2] = plte?.[k * 3 + 2] ?? 0; out[d + 3] = trns && k < trns.length ? trns[k] : 255; }
  }
  return { width: w, height: h, data: out };
}

/** Latitud del centro de la fila y de una imagen Web Mercator de altura h que cubre ±85,05°. */
export const mercLat = (y: number, h: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / h))) * 180) / Math.PI;
/** Límite de latitud de Web Mercator (las imágenes cubren de −MERC_MAX a +MERC_MAX). */
export const MERC_MAX = 85.0511287798066;
