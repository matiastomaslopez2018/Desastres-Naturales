/* Lava, flujos piroclásticos y lahares sobre el relieve del volcán, en un worker (no traba la página). */
import { energyCone, lahar, lavaFlow, type Dem } from '@/lib/volcano/hazards';

export type HazardKind = 'lava' | 'pdc' | 'lahar';
export type HazardIn =
  | { id: number; kind: 'lava'; dem: Dem; lengthM: number }
  | { id: number; kind: 'pdc'; dem: Dem; collapseM: number; angleDeg: number }
  | { id: number; kind: 'lahar'; dem: Dem; volume: number };
export type HazardOut = { id: number; kind: HazardKind; value: Float32Array; arrival: Float32Array; reachM: number; starts?: number; n: number };

self.onmessage = (e: MessageEvent<HazardIn>) => {
  const m = e.data;
  const r = m.kind === 'lava' ? lavaFlow(m.dem, { lengthM: m.lengthM, runs: 600 })
    : m.kind === 'pdc' ? energyCone(m.dem, { collapseM: m.collapseM, angleDeg: m.angleDeg })
    : lahar(m.dem, { volume: m.volume });
  const out: HazardOut = { id: m.id, kind: m.kind, value: r.value, arrival: r.arrival, reachM: r.reachM, starts: 'starts' in r ? (r as { starts: number }).starts : undefined, n: m.dem.n };
  (self as unknown as Worker).postMessage(out, [r.value.buffer, r.arrival.buffer]);
};
