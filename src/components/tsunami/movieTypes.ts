/* Datos que reciben las escenas de la película (3D y 2D). */
import type { Grid } from '@/lib/tsunami/swe';
import type { OceanBox } from '@/lib/tsunami/presets';
import type { Gauge } from '@/lib/tsunami/analysis';
import type { Timing } from '@/lib/tsunami/movie';
import type { Lang } from '@/lib/types';
import type { FineSource, LocalBirth } from './tsunami.worker';

export type MovieClock = { now: () => number; subscribe: (fn: (t: number) => void) => () => void };

export type MovieInput = {
  lang: Lang;
  grid: Grid; wet: Uint8Array; box: OceanBox;
  frames: Int8Array[]; frameS: number; amp: number;
  local: LocalBirth; fine: FineSource;
  gauges: Gauge[]; sites: { name: string; lon: number; lat: number }[]; epi: [number, number];
  /** Lugar de la costa del capítulo final y su nivel estimado en la orilla (m) cada `shoreDt` s. */
  coastSite: number; shore: Float32Array; shoreDt: number; shoreYMax: number;
  timing: Timing;
};

export type SceneProps = MovieInput & { clock: MovieClock; onFail: () => void; onReady?: () => void };
