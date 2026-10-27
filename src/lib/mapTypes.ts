import type { DisasterEvent, GvpVolcano, HeatBin, HistTrack, NhcStorm, VolcanoActivity } from './types';

/*
 * Tipos y constantes del mapa (globo MapLibre): qué se puede tocar, qué capas hay y los
 * colores que comparten el mapa, las fichas, Aprender y el ranking.
 */

export type DartBuoy = { id: string; type: 'dart'; title: string; lon: number; lat: number; reporting: boolean; owner: string };
export type SpcReport = { id: string; type: 'spc'; kind: 'tornado' | 'wind' | 'hail'; title: string; lon: number; lat: number; time: number; magnitude: string; county: string; state: string; comments: string };
export type GlcSlide = { id: string; type: 'glc'; title: string; lon: number; lat: number; time: number | null; deaths: number; trigger: string | null; link: string | null; country: string | null; category: string | null };
/** Alerta meteorológica del SMN (Argentina): zona coloreada por nivel; "next" = empieza más adelante. */
export type SmnAlertP = {
  id: string; type: 'smn'; title: string; level: 'yellow' | 'orange' | 'red'; lon: number; lat: number;
  onset: number; expires: number; description: string; instruction: string[]; geometry: GeoJSON.MultiPolygon;
};
export type ColoredArea = { fill: string; stroke: string; geometry: GeoJSON.Geometry };

export type Pickable = DisasterEvent | GvpVolcano | NhcStorm | HeatBin | VolcanoActivity | HistTrack | DartBuoy | SpcReport | GlcSlide | SmnAlertP;

export type Layers = {
  borders: boolean; plates: boolean; ring: boolean; gvp: boolean; hazard: boolean;
  nhc: boolean; firms: boolean; wvolc: boolean; ibtracs: boolean;
  slab: boolean; platevec: boolean; dart: boolean; fwi: boolean; wind: boolean;
  lhasa: boolean; glc: boolean; spc: boolean; smn: boolean;
};

/** Datos de las capas que no son eventos del catálogo (los rásteres los pide el propio globo). */
export type Overlays = {
  storms: NhcStorm[]; heat: HeatBin[]; volcanoes: VolcanoActivity[]; tracks: HistTrack[];
  /** Animación de la trayectoria de un ciclón: se dibuja hasta el instante t (ms). */
  stormAnim?: { id: string; t: number } | null;
  slab?: [string, number, number[][][]][] | null;
  vectors?: [number, number, number, number, string][] | null;
  darts?: DartBuoy[];
  wind?: { points: [number, number, number, number][] } | null;
  glc?: GlcSlide[];
  spcOutlook?: ColoredArea[];
  spcReports?: SpcReport[];
  nwsWarnings?: ColoredArea[];
  smn?: SmnAlertP[];
};

export interface GlobeHandle {
  /** Vuela al elemento con inclinación y zoom según el tipo. */
  focus(p: Pickable): void;
  zoomBy(f: number): void;
  /** Vuelve a la vista inicial. */
  reset(): void;
}

/**
 * Colores fijos por tipo ("Observatorio claro"): los mismos en el mapa, las fichas, Aprender y el
 * ranking. Tsunami queda en la familia del azul de ciclones; deslizamiento, en la de la sequía.
 */
export const TYPE_COLOR = {
  eq: '#e8590c', volcano: '#d6336c', fire: '#f59f00', storm: '#228be6', flood: '#12b886', drought: '#b08c4a',
  tsunami: '#0c8599', landslide: '#8f5b2e', gvp: '#868e96',
} as const;

/** Niveles de alerta del SMN (amarillo, naranja y rojo de su mapa). */
export const SMN_COLORS = { yellow: '#fcc419', orange: '#fd7e14', red: '#e03131' } as const;

/** Reportes de SPC (mismos colores que usa SPC en sus mapas). */
export const SPC_COLORS = { tornado: '#e03131', wind: '#1c7ed6', hail: '#2f9e44' } as const;

/** Amenaza sísmica GEM 2023: límite inferior de cada clase (g) y color de la paleta oficial. */
export const HAZARD_LEVELS: [number, string][] = [
  [0.02, 'rgb(181,202,255)'], [0.03, 'rgb(143,179,255)'], [0.05, 'rgb(127,151,255)'], [0.08, 'rgb(171,207,99)'], [0.13, 'rgb(232,245,158)'],
  [0.2, 'rgb(255,250,20)'], [0.35, 'rgb(255,209,33)'], [0.55, 'rgb(255,163,10)'], [0.9, 'rgb(255,76,0)'],
];

/** Escala Saffir-Simpson (viento sostenido en kt) con los colores habituales de los mapas de ciclones. */
export const SS_SCALE: [number, string, string][] = [
  [0, '#5ebaff', 'TD'], [34, '#00c5bd', 'TS'], [64, '#f2d94e', '1'], [83, '#ffc140', '2'], [96, '#ff9b2f', '3'], [113, '#ff6a20', '4'], [137, '#e03131', '5'],
];
export const ssColor = (kt: number | null) => (kt == null ? '#5a5a5a' : [...SS_SCALE].reverse().find(([v]) => kt >= v)![1]);
