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
