/*
 * Batimetría global para el simulador de tsunamis: ETOPO1 (NOAA NCEI; Amante y Eakins, 2009), dominio
 * público, bajada del servidor ERDDAP de la NOAA cada 15 minutos de arco (un nodo de cada 15 de la grilla
 * de 1′), entre 78° S y 78° N. Se guarda como enteros de 16 bits (m, negativo bajo el mar) comprimidos con
 * gzip en public/data/tsunami/etopo1-15m.bin.gz, con un .json de metadatos.
 *   npx tsx scripts/etopo.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const OUT = join(process.cwd(), 'public', 'data', 'tsunami');
const HOSTS = ['https://upwell.pfeg.noaa.gov', 'https://coastwatch.pfeg.noaa.gov'];
const STEP = 0.25, LAT0 = -78, LAT1 = 78, LON0 = 0, LON1 = 359.75;

async function band(lat0: number, lat1: number) {
  const q = `altitude%5B(${lat0}):15:(${lat1})%5D%5B(${LON0}):15:(${LON1})%5D`;
  for (let i = 0; i < 8; i++) {
    const host = HOSTS[i % HOSTS.length];
    try {
      const r = await fetch(`${host}/erddap/griddap/etopo360.csv?${q}`);
      const text = await r.text();
      if (!r.ok || text.startsWith('Error')) throw new Error(text.slice(0, 120));
      return text.trim().split(/\r?\n/).slice(2).map((l) => l.split(',').map(Number)); // lat, lon, altitude
    } catch (e) {
      console.log(`  reintento ${i + 1} (${host}): ${String(e).slice(0, 100)}`);
      await new Promise((res) => setTimeout(res, 5000 * (i + 1)));
    }
  }
  throw new Error(`no se pudo bajar ${lat0}..${lat1}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const nx = Math.round((LON1 - LON0) / STEP) + 1, ny = Math.round((LAT1 - LAT0) / STEP) + 1;
  const z = new Int16Array(nx * ny).fill(-32768);
  for (let a = LAT0; a < LAT1 + STEP / 2; a += 20) {
    const b = Math.min(LAT1, a + 20 - STEP);
    const rows = await band(a, b);
    for (const [lat, lon, alt] of rows) {
      const j = Math.round((lat - LAT0) / STEP), i = Math.round((lon - LON0) / STEP);
      if (j >= 0 && j < ny && i >= 0 && i < nx) z[j * nx + i] = Math.max(-32767, Math.min(32767, Math.round(alt)));
    }
    console.log(`latitudes ${a}..${b}: ${rows.length} nodos`);
  }
  const missing = z.filter((v) => v === -32768).length;
  if (missing) throw new Error(`${missing} nodos sin dato`);
  const buf = gzipSync(Buffer.from(z.buffer), { level: 9 });
  writeFileSync(join(OUT, 'etopo1-15m.bin.gz'), buf);
  writeFileSync(join(OUT, 'etopo1-15m.json'), JSON.stringify({
    source: 'NOAA NCEI ETOPO1 (Amante & Eakins 2009), ERDDAP etopo360, cada 15′', nx, ny, lon0: LON0, lat0: LAT0, step: STEP, rows: 'sur a norte', units: 'm',
  }));
  console.log(`${nx}×${ny} · ${(buf.length / 1024 / 1024).toFixed(2)} MB comprimido`);
}
main();
