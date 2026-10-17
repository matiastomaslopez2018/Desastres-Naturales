/**
 * Índice espacial de IBTrACS para "ciclones históricos que pasaron por esta zona":
 * tormentas desde 1980 que llegaron a 64 kt (fuerza de huracán/tifón), en celdas de 2°.
 *   src/data/ibtracs_grid.json  { storms: [sid, nombre, temporada, viento, cuenca][], cells: { "x,y": índices[] } }
 *
 *   npm run ibtracs-grid   (después de npm run ibtracs)
 */
import { readFileSync, writeFileSync } from 'node:fs';

type Storm = { sid: string; name: string; basin: string; season: number; wind: number | null; pts: [number, number, number | null][] };
const storms: [string, string, number, number, string][] = [];
const cells: Record<string, number[]> = {};
const now = new Date().getUTCFullYear();
for (let y = 1980; y <= now; y++) {
  let list: Storm[];
  try { list = JSON.parse(readFileSync(`public/data/ibtracs/${y}.json`, 'utf8')); } catch { continue; }
  for (const s of list) {
    if ((s.wind ?? 0) < 64) continue;
    const i = storms.push([s.sid, s.name, s.season, s.wind!, s.basin]) - 1;
    const seen = new Set<string>();
    for (const [lon, lat] of s.pts) {
      const k = `${Math.floor(lon / 2)},${Math.floor(lat / 2)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      (cells[k] ??= []).push(i);
    }
  }
}
writeFileSync('src/data/ibtracs_grid.json', JSON.stringify({ storms, cells }));
console.log(`${storms.length} ciclones, ${Object.keys(cells).length} celdas`);
