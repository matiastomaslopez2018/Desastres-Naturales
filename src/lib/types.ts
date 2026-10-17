export type EventType = 'eq' | 'volcano' | 'fire' | 'storm' | 'flood' | 'drought';
export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';
export type Source = 'USGS' | 'NASA EONET' | 'GDACS';
export type RangeKey = '24h' | '7d' | '30d' | '1y' | 'year';
export type Lang = 'es' | 'en';

export interface Link { label: string; url: string }

/** Modelo unificado de evento (ver README §2). */
export interface DisasterEvent {
  id: string;
  type: EventType;
  src: Source;
  lon: number;
  lat: number;
  depth?: number;
  time: number;
  start?: number;
  end?: number;
  mag?: number | null;
  magType?: string;
  magUnit?: string;
  status?: string;
  closed?: boolean;
  tsunami?: boolean;
  pager?: AlertLevel | null;
  alert?: AlertLevel | null;
  severity?: string;
  country?: string;
  /** ISO 3166-1 alfa-3 del país (punto-en-polígono o informado por la fuente). */
  iso3?: string;
  track?: [number, number][] | null;
  felt?: number | null;
  net?: string;
  title: string;
  url?: string;
  gdacsUrl?: string;
  apiUrl?: string;
  links?: Link[];
  /** Número GLIDE (GDACS): permite enlazar reportes humanitarios de ReliefWeb. */
  glide?: string;
}

export interface GvpVolcano {
  id: string;
  type: 'gvp';
  src: 'GVP';
  lon: number;
  lat: number;
  title: string;
  country?: string;
  vtype?: string;
  lastErup?: number | null;
  num: number;
}

export type SourceKey = 'usgs' | 'eonet' | 'gdacs' | 'gvp' | 'carto';
export type SourceState = 'ok' | 'err' | 'wait';
export interface SourceStatus { state: SourceState; count?: number; at?: number }

export interface EventsResponse {
  events: DisasterEvent[];
  sources: Partial<Record<SourceKey, SourceStatus>>;
  fetchedAt: number;
  range: { start: string; end: string; floor: number };
}

export interface EqDetail {
  hErr: number | null;
  vErr: number | null;
  magErr: number | null;
  nst: number | null;
  gap: number | null;
  mmi: number | null;
  dyfi: number | null;
}

/* ───────────── Fase 2 · Bloque B: capas de otras fuentes ───────────── */

/** Ciclón activo según NOAA NHC (Atlántico y Pacífico este/central). */
export interface NhcStorm {
  id: string;
  type: 'nhc';
  src: 'NOAA NHC';
  title: string;
  name: string;
  /** HU, TS, TD, STS, STD, PTC… */
  classification: string;
  lon: number;
  lat: number;
  windKt: number | null;
  pressureMb: number | null;
  movementDir: number | null;
  movementSpeedMph: number | null;
  lastUpdate: number;
  advisoryUrl?: string;
  discussionUrl?: string;
  /** Cono de pronóstico (polígono GIS de NHC). */
  cone?: GeoJSON.Geometry | null;
  pastTrack?: [number, number][][];
  forecastTrack?: [number, number][];
  forecastPoints?: { lon: number; lat: number; label: string; windKt: number | null; cat: string }[];
}

/** Agregado de focos de calor NASA FIRMS (VIIRS) en una celda de la grilla. */
export interface HeatBin {
  id: string;
  type: 'heat';
  src: 'NASA FIRMS';
  title: string;
  lon: number;
  lat: number;
  count: number;
  frpMax: number;
  frpSum: number;
  /** Última detección (ms). */
  last: number;
}

/** Volcán con actividad: reporte semanal GVP/USGS o erupción en curso de la base GVP. */
export interface VolcanoActivity {
  id: string;
  type: 'wvolc';
  src: 'GVP';
  title: string;
  lon: number;
  lat: number;
  country?: string;
  /** "new" = nueva actividad esta semana; "ongoing" = en curso. */
  status: 'new' | 'ongoing';
  /** Texto del reporte semanal, si está disponible. */
  report?: string;
  reportPeriod?: string;
  /** Inicio de la erupción en curso (base GVP), "AAAAMMDD". */
  since?: string;
  vei?: number | null;
  gvpUrl: string;
  origin: 'weekly' | 'eruptions';
}

/** Mensaje de un centro de alerta de tsunamis de NOAA (NTWC/PTWC). */
export interface TsunamiMessage {
  id: string;
  center: 'NTWC' | 'PTWC';
  level: 'warning' | 'advisory' | 'watch' | 'information' | 'cancellation' | 'other';
  title: string;
  region: string;
  issued: number;
  lat: number | null;
  lon: number | null;
  magnitude: number | null;
  url: string;
}

/** Trayectoria histórica de un ciclón (IBTrACS). Puntos: [lon, lat, viento kt | null]. */
export interface HistTrack {
  id: string;
  type: 'ibtracs';
  src: 'IBTrACS';
  title: string;
  name: string;
  basin: string;
  season: number;
  windKt: number | null;
  pressureMb: number | null;
  start: number;
  end: number;
  lon: number;
  lat: number;
  points: [number, number, number | null][];
}

/** Segunda fuente sísmica (EMSC) para un sismo de USGS. */
export interface EmscMatch {
  unid: string;
  mag: number | null;
  magType: string;
  region: string;
  time: number;
  distanceKm: number;
  felt: number | null;
  url: string;
}

/** Sismo o tsunami histórico significativo (NOAA NCEI). */
export interface HistoricEvent {
  id: string;
  kind: 'eq' | 'tsunami';
  year: number;
  month: number | null;
  day: number | null;
  location: string;
  lat: number;
  lon: number;
  mag: number | null;
  deaths: number | null;
  injuries: number | null;
  damageMillionsUsd: number | null;
  housesDestroyed: number | null;
  maxWaterHeight?: number | null;
  url: string;
}
