/*
 * Peligros del volcán sobre el relieve (grilla n×n, filas de norte a sur, celdas cuadradas de `cell` m):
 *
 * - Lava: método estocástico DOWNFLOW (Favalli et al., 2005). Se trazan muchos caminos de máxima pendiente
 *   desde la boca, cada uno sobre el relieve con una perturbación al azar de ±Δh en cada celda (las
 *   irregularidades que el modelo de elevación no ve); la fracción de caminos que pasa por cada celda es la
 *   probabilidad de que la cubra la lava. El largo máximo de la colada lo fija quien simula.
 * - Flujos piroclásticos: cono de energía (Malin y Sheridan, 1982). Desde una altura de colapso sobre la
 *   boca baja una línea con el ángulo de movilidad; el flujo llega a donde esa línea va por encima del
 *   terreno, en línea recta desde la boca y sin que un cerro intermedio lo frene.
 * - Lahares: LAHARZ (Iverson et al., 1998; Schilling, 1998). Para un volumen V, la sección inundada del valle
 *   es A = 0,05·V^(2/3) y el área total cubierta B = 200·V^(2/3) (m², V en m³). Se recorren los cauces que
 *   salen de la zona proximal (cono de H/L = 0,3 desde la cumbre) llenando cada sección hasta cubrir B.
 */

export type Dem = { h: Float32Array; n: number; cell: number };
/** Resultado: intensidad o probabilidad (0–1) y avance relativo en que llega a cada celda (0–1; >1 si no llega). */
export type Hazard = { value: Float32Array; arrival: Float32Array; reachM: number };

const NB = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const DIAG = Math.SQRT2;

/** Generador con semilla (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Celda de partida: la más alta dentro de `radiusM` del centro (el borde del cráter, por donde desborda). */
export function ventCell(d: Dem, radiusM = 800) {
  const c = (d.n - 1) / 2, r = Math.ceil(radiusM / d.cell);
  let best = Math.round(c) * d.n + Math.round(c), hb = -Infinity;
  for (let j = Math.round(c - r); j <= c + r; j++) for (let i = Math.round(c - r); i <= c + r; i++) {
    if (Math.hypot(i - c, j - c) > r) continue;
    const k = j * d.n + i;
    if (d.h[k] > hb) { hb = d.h[k]; best = k; }
  }
  return best;
}

/* ───────────── Lava (DOWNFLOW) ───────────── */

export function lavaFlow(d: Dem, opts: { lengthM: number; runs?: number; dh?: number; seed?: number }): Hazard {
  const { n, cell } = d, runs = opts.runs ?? 800, dh = opts.dh ?? 3, r = rng(opts.seed ?? 1);
  const count = new Uint16Array(n * n), distSum = new Float32Array(n * n);
  const start = ventCell(d), noise = new Float32Array(n * n);
  let reach = 0;
  for (let run = 0; run < runs; run++) {
    for (let k = 0; k < noise.length; k++) noise[k] = (r() * 2 - 1) * dh;
    let k = start, dist = 0;
    const seen = new Set<number>();
    while (dist < opts.lengthM) {
      if (!seen.has(k)) { seen.add(k); count[k]++; distSum[k] += dist; }
      const i = k % n, j = (k - i) / n;
      let best = -1, drop = 0, step = 0;
      for (const [di, dj] of NB) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
        const kk = jj * n + ii, len = di && dj ? cell * DIAG : cell;
        const s = (d.h[k] + noise[k] - d.h[kk] - noise[kk]) / len;
        if (s > drop) { drop = s; best = kk; step = len; }
      }
      if (best < 0) break; // hoyo: la lava se estanca
      k = best; dist += step;
      if (k % n === 0 || k % n === n - 1 || k < n || k >= n * (n - 1)) break; // borde del recuadro
    }
    reach = Math.max(reach, dist);
  }
  const value = new Float32Array(n * n), arrival = new Float32Array(n * n).fill(2);
  for (let k = 0; k < n * n; k++) if (count[k]) { value[k] = count[k] / runs; arrival[k] = distSum[k] / count[k] / Math.max(1, opts.lengthM); }
  return { value, arrival, reachM: reach };
}

/* ───────────── Flujos piroclásticos (cono de energía) ───────────── */

export function energyCone(d: Dem, opts: { collapseM: number; angleDeg: number }): Hazard {
  const { n, cell } = d, start = ventCell(d, 500), si = start % n, sj = (start - si) / n;
  const top = d.h[start] + opts.collapseM, slope = Math.tan((opts.angleDeg * Math.PI) / 180);
  // Llegada en metros (Infinity = no llega); al final se pasa a fracción del alcance (2 = no llega).
  const value = new Float32Array(n * n), arrival = new Float32Array(n * n).fill(Infinity);
  let reach = 0;
  // Rayos desde la boca: el flujo avanza mientras la línea de energía vaya por encima del terreno.
  const rays = 1440, maxR = n * cell;
  for (let a = 0; a < rays; a++) {
    const th = (a / rays) * Math.PI * 2, cx = Math.cos(th), cy = Math.sin(th);
    for (let dist = cell * 0.5; dist < maxR; dist += cell * 0.5) {
      const fi = si + (cx * dist) / cell, fj = sj - (cy * dist) / cell, i = Math.round(fi), j = Math.round(fj);
      if (i < 0 || j < 0 || i >= n || j >= n) break;
      const k = j * n + i, energy = top - slope * dist - d.h[k];
      if (energy <= 0) break;
      value[k] = Math.max(value[k], energy);
      arrival[k] = Math.min(arrival[k], dist);
      reach = Math.max(reach, dist);
    }
  }
  // Intensidad relativa (altura de energía) y avance normalizados.
  let vmax = 0;
  value.forEach((v) => { vmax = Math.max(vmax, v); });
  for (let k = 0; k < n * n; k++) { if (value[k] > 0) { value[k] = 0.35 + 0.65 * Math.sqrt(value[k] / vmax); arrival[k] /= Math.max(1, reach); } else arrival[k] = 2; }
  return { value, arrival, reachM: reach };
}

/* ───────────── Lahares (LAHARZ) ───────────── */

/** Relleno de hoyos (priority-flood, Barnes et al. 2014) para que el agua siempre encuentre salida. */
function fill(d: Dem) {
  const { n } = d, z = Float32Array.from(d.h), done = new Uint8Array(n * n);
  // Montículo binario simple sobre índices.
  const heap: number[] = [];
  const push = (k: number) => { heap.push(k); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (z[heap[p]] <= z[heap[i]]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && z[heap[l]] < z[heap[m]]) m = l; if (r < heap.length && z[heap[r]] < z[heap[m]]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (let k = 0; k < n * n; k++) { const i = k % n, j = (k - i) / n; if (i === 0 || j === 0 || i === n - 1 || j === n - 1) { done[k] = 1; push(k); } }
  while (heap.length) {
    const k = pop(), i = k % n, j = (k - i) / n;
    for (const [di, dj] of NB) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const kk = jj * n + ii;
      if (done[kk]) continue;
      done[kk] = 1;
      if (z[kk] < z[k]) z[kk] = z[k] + 1e-3;
      push(kk);
    }
  }
  return z;
}

export function lahar(d: Dem, opts: { volume: number; channels?: number }): Hazard & { starts: number } {
  const { n, cell } = d, z = fill(d);
  // Dirección de flujo D8 y área de aporte.
  const dir = new Int32Array(n * n).fill(-1), acc = new Float32Array(n * n).fill(1);
  for (let k = 0; k < n * n; k++) {
    const i = k % n, j = (k - i) / n;
    let best = -1, s = 0;
    for (const [di, dj] of NB) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const kk = jj * n + ii, sl = (z[k] - z[kk]) / (di && dj ? DIAG : 1);
      if (sl > s) { s = sl; best = kk; }
    }
    dir[k] = best;
  }
  const order = Array.from({ length: n * n }, (_, k) => k).sort((a, b) => z[b] - z[a]);
  for (const k of order) if (dir[k] >= 0) acc[dir[k]] += acc[k];
  // Zona proximal: cono de H/L = 0,3 desde la cumbre. Los lahares arrancan donde los cauces salen de ella.
  const summit = ventCell(d, 1500), si = summit % n, sj = (summit - si) / n;
  const inside = (k: number) => { const i = k % n, j = (k - i) / n; return d.h[summit] - d.h[k] >= 0.3 * Math.hypot(i - si, j - sj) * cell; };
  const minAcc = Math.max(20, (1e6 / (cell * cell)) * 0.5); // cauces con ~0,5 km² de cuenca o más
  const starts: number[] = [];
  for (let k = 0; k < n * n; k++) if (dir[k] >= 0 && acc[k] >= minAcc && inside(k) && !inside(dir[k])) starts.push(dir[k]);
  // Los cauces principales (más cuenca), sin repetir el mismo valle.
  starts.sort((a, b) => acc[b] - acc[a]);
  const chosen: number[] = [], used = new Set<number>();
  for (const s of starts) {
    if (chosen.length >= (opts.channels ?? 8)) break;
    let k = s, dup = false;
    for (let step = 0; step < 40 && k >= 0; step++) { if (used.has(k)) { dup = true; break; } k = dir[k]; }
    if (dup) continue;
    chosen.push(s);
    for (let k2 = s, step = 0; step < 2000 && k2 >= 0; step++) { used.add(k2); k2 = dir[k2]; }
  }
  const A = 0.05 * opts.volume ** (2 / 3), B = 200 * opts.volume ** (2 / 3);
  // Llegada en metros a lo largo del cauce (Infinity = no llega); al final, fracción del alcance (2 = no llega).
  const value = new Float32Array(n * n), arrival = new Float32Array(n * n).fill(Infinity);
  let reach = 0;
  for (const s of chosen) {
    let k = s, area = 0, dist = 0;
    // Línea del cauce con el nivel del barro en cada celda.
    const center: { k: number; lev: number; dist: number }[] = [];
    while (k >= 0 && area < B) {
      const i = k % n, j = (k - i) / n, nx = dir[k];
      if (nx < 0) break;
      // Sección perpendicular al flujo: hasta 1,5 km a cada lado, en dos mitades ordenadas desde el cauce.
      const ni = nx % n, nj = (nx - ni) / n, fx = ni - i, fy = nj - j, L = Math.hypot(fx, fy), px = -fy / L, py = fx / L;
      const sides: number[][] = [[], []];
      sides.forEach((side, si) => { const sgn = si ? -1 : 1; for (let q = 1; q * cell <= 1500; q++) {
        const ii = Math.round(i + sgn * px * q), jj = Math.round(j + sgn * py * q);
        if (ii < 0 || jj < 0 || ii >= n || jj >= n) break;
        side.push(jj * n + ii);
      } });
      // Celdas inundadas con el nivel `lev`: el cauce y, hacia cada lado, hasta la primera celda que lo supera
      // (el barro no salta una loma para inundar el valle de al lado).
      const flooded = (lev: number) => { const out = [k]; for (const side of sides) for (const c of side) { if (d.h[c] >= lev) break; out.push(c); } return out; };
      // Nivel tal que el área de la sección sea A (bisección).
      let lo = d.h[k], hi = d.h[k] + 200;
      for (let it = 0; it < 30; it++) {
        const mid = (lo + hi) / 2;
        const sec = flooded(mid).reduce((sum, c) => sum + Math.max(0, mid - d.h[c]) * cell, 0);
        if (sec < A) lo = mid; else hi = mid;
      }
      center.push({ k, lev: lo, dist });
      area += flooded(lo).length * cell * cell;
      dist += L * cell; k = nx;
      if (k % n === 0 || k % n === n - 1 || k < n || k >= n * (n - 1)) break;
    }
    // Zona inundada: desde el cauce, las celdas conectadas que quedan bajo el nivel del barro de la celda del cauce
    // más cercana, hasta 1,5 km. Así el borde sigue las curvas de nivel del valle en vez de franjas sueltas.
    const src = new Int32Array(n * n).fill(-1), dd = new Float32Array(n * n).fill(Infinity), maxD = 1500 / cell;
    const heap: number[] = [];
    const less = (a: number, b: number) => dd[a] < dd[b];
    const push = (x: number) => { heap.push(x); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!less(heap[i], heap[p])) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    // 1) Celda del cauce más cercana a cada celda (distancia en la grilla, hasta 1,5 km). Comparar con el nivel
    //    de la celda del cauce más cercana, y no con el de más arriba, evita inundar todo lo que queda cuesta abajo.
    center.forEach((c, ci) => { if (dd[c.k] > 0) { dd[c.k] = 0; src[c.k] = ci; push(c.k); } });
    const done = new Uint8Array(n * n);
    while (heap.length) {
      const x = pop();
      if (done[x]) continue;
      done[x] = 1;
      const xi = x % n, xj = (x - xi) / n;
      for (const [di, dj] of NB) {
        const ii = xi + di, jj = xj + dj;
        if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
        const y = jj * n + ii, nd = dd[x] + (di && dj ? DIAG : 1);
        if (done[y] || nd > maxD || nd >= dd[y]) continue;
        dd[y] = nd; src[y] = src[x]; push(y);
      }
    }
    // 2) Desde el cauce, las celdas conectadas que quedan bajo el nivel del barro de su celda del cauce más cercana.
    const wet: number[] = [], seen = new Uint8Array(n * n), queue = center.map((c) => c.k);
    for (const q of queue) seen[q] = 1;
    while (queue.length) {
      const x = queue.pop()!;
      wet.push(x);
      const xi = x % n, xj = (x - xi) / n;
      for (const [di, dj] of NB) {
        const ii = xi + di, jj = xj + dj;
        if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
        const y = jj * n + ii;
        if (seen[y] || src[y] < 0 || d.h[y] >= center[src[y]].lev) continue;
        seen[y] = 1; queue.push(y);
      }
    }
    // Se recorta al área total B, en el orden en que llega el barro.
    wet.sort((a, b) => center[src[a]].dist - center[src[b]].dist || dd[a] - dd[b]);
    const keep = Math.max(center.length, Math.round(B / (cell * cell)));
    let last = 0;
    for (const x of wet.slice(0, keep)) { const t = center[src[x]].dist; value[x] = 1; arrival[x] = Math.min(arrival[x], t); last = Math.max(last, t); }
    reach = Math.max(reach, last);
  }
  // Cierre morfológico (dilatar y erosionar una celda): rellena huecos sueltos dentro de la zona inundada.
  const dil = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) if (value[k]) { const i = k % n, j = (k - i) / n; for (const [di, dj] of NB) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < n && jj < n) dil[jj * n + ii] = 1; } dil[k] = 1; }
  for (let k = 0; k < n * n; k++) {
    if (!dil[k] || value[k]) continue;
    const i = k % n, j = (k - i) / n;
    let all = true, best = Infinity;
    for (const [di, dj] of NB) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= n || jj >= n || !dil[jj * n + ii]) { all = false; break; } }
    if (!all) continue;
    for (const [di, dj] of NB) { const kk = (j + dj) * n + (i + di); if (value[kk]) best = Math.min(best, arrival[kk]); }
    if (Number.isFinite(best)) { value[k] = 1; arrival[k] = best; }
  }
  for (let k = 0; k < n * n; k++) arrival[k] = value[k] ? arrival[k] / Math.max(1, reach) : 2;
  return { value, arrival, reachM: reach, starts: chosen.length };
}
