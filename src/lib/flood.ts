/*
 * Simulador de inundaciones ("modelo de bañera"): con el relieve de Terrain Tiles (formato Terrarium, zoom 13)
 * alrededor del punto elegido, calcula para cada celda el nivel de agua mínimo con el que se inundaría si el agua
 * sube desde ese punto (algoritmo "priority-flood", Barnes et al., 2014): el agua avanza por la vecina más baja y
 * llena cada hondonada hasta desbordar. Con eso, inundar a cualquier altura es solo comparar: nivel ≤ agua.
 */

export const FLOOD_Z = 13;
export const DEM_TILE = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

/** Tile (fraccional) de una coordenada en Web Mercator. */
export function tileXY(lon: number, lat: number, z: number) {
  const n = 2 ** z, r = (lat * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
}
/** Coordenada de una esquina de tile. */
export function tileLonLat(x: number, y: number, z: number): [number, number] {
  const n = 2 ** z;
  return [(x / n) * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI];
}

/** Terrarium: altura (m) = R·256 + G + B/256 − 32768. */
export function decodeTerrarium(data: Uint8ClampedArray, out: Float32Array, offset: number, stride: number, size = 256) {
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    out[offset + y * stride + x] = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
  }
}

/** Ventana de relieve: `tiles`×`tiles` alrededor del punto; devuelve la grilla y sus esquinas. */
export type DemWindow = {
  w: number; h: number; elev: Float32Array; x0: number; y0: number; z: number;
  /** Esquinas [lon, lat]: arriba-izq., arriba-der., abajo-der., abajo-izq. */
  corners: [[number, number], [number, number], [number, number], [number, number]];
  /** Lado de una celda (m) en la latitud del centro. */
  cellM: number;
};

export async function loadDem(lon: number, lat: number, tiles = 4, z = FLOOD_Z): Promise<DemWindow> {
  const c = tileXY(lon, lat, z), x0 = Math.floor(c.x - tiles / 2 + 0.5), y0 = Math.floor(c.y - tiles / 2 + 0.5);
  const w = tiles * 256, h = tiles * 256, elev = new Float32Array(w * h);
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const jobs: Promise<void>[] = [];
  for (let ty = 0; ty < tiles; ty++) for (let tx = 0; tx < tiles; tx++) {
    jobs.push((async () => {
      const r = await fetch(DEM_TILE(z, x0 + tx, y0 + ty));
      if (!r.ok) throw new Error(`DEM ${r.status}`);
      const bmp = await createImageBitmap(await r.blob());
      // Un solo lienzo para decodificar: se dibuja y se lee de a una por vez.
      ctx.clearRect(0, 0, 256, 256); ctx.drawImage(bmp, 0, 0);
      decodeTerrarium(ctx.getImageData(0, 0, 256, 256).data, elev, ty * 256 * w + tx * 256, w);
      bmp.close();
    })());
  }
  await Promise.all(jobs);
  const cellM = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** z);
  return {
    w, h, elev, x0, y0, z, cellM,
    corners: [tileLonLat(x0, y0, z), tileLonLat(x0 + tiles, y0, z), tileLonLat(x0 + tiles, y0 + tiles, z), tileLonLat(x0, y0 + tiles, z)],
  };
}

/** Celda de la ventana que contiene una coordenada (o null si queda afuera). */
export function cellAt(d: DemWindow, lon: number, lat: number) {
  const t = tileXY(lon, lat, d.z), cx = Math.floor((t.x - d.x0) * 256), cy = Math.floor((t.y - d.y0) * 256);
  return cx < 0 || cy < 0 || cx >= d.w || cy >= d.h ? null : cy * d.w + cx;
}

/**
 * Nivel del agua (m) con el que se inunda cada celda si el agua entra por `seed` a la altura `base`:
 * el mínimo, entre todos los caminos desde el origen, de la altura máxima del camino.
 */
export function floodLevels(elev: Float32Array, w: number, h: number, seed: number, base: number) {
  const n = w * h, level = new Float32Array(n).fill(Infinity);
  // Montículo binario de índices ordenado por nivel.
  const heap = new Int32Array(n), key = new Float32Array(n);
  let size = 0;
  const push = (i: number, k: number) => {
    let j = size++;
    while (j > 0) { const p = (j - 1) >> 1; if (key[p] <= k) break; heap[j] = heap[p]; key[j] = key[p]; j = p; }
    heap[j] = i; key[j] = k;
  };
  const pop = () => {
    const top = heap[0], last = heap[--size], lk = key[size];
    let j = 0;
    for (;;) {
      let c = 2 * j + 1;
      if (c >= size) break;
      if (c + 1 < size && key[c + 1] < key[c]) c++;
      if (key[c] >= lk) break;
      heap[j] = heap[c]; key[j] = key[c]; j = c;
    }
    heap[j] = last; key[j] = lk;
    return top;
  };
  // Se sacan en orden creciente de nivel: el primero que alcanza una celda le da su nivel definitivo, así que
  // cada celda entra una sola vez al montículo (alcanza con n lugares).
  const seen = new Uint8Array(n);
  level[seed] = Math.max(base, elev[seed]);
  push(seed, level[seed]); seen[seed] = 1;
  while (size) {
    const i = pop();
    const x = i % w, y = (i - x) / w, li = level[i];
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if ((!dx && !dy) || xx < 0 || xx >= w) continue;
        const j = yy * w + xx;
        if (seen[j]) continue;
        seen[j] = 1; level[j] = Math.max(li, elev[j]); push(j, level[j]);
      }
    }
  }
  return level;
}

/** Altura del agua en el origen: la más baja alrededor del punto tocado (radio de `r` celdas), para no caer en un borde. */
export function waterBase(elev: Float32Array, w: number, h: number, seed: number, r = 3) {
  const x = seed % w, y = (seed - x) / w;
  let best = seed;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    const j = yy * w + xx;
    if (elev[j] < elev[best]) best = j;
  }
  return { seed: best, base: elev[best] };
}
