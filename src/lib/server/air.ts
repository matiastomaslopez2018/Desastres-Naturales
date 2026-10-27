import 'server-only';
import { kvCached } from './kvCache';

/*
 * Calidad del aire en un punto: pronóstico global de Copernicus CAMS (ECMWF), leído con la API de calidad
 * del aire de Open-Meteo (que redistribuye CAMS con licencia CC BY 4.0). Partículas finas PM2,5 y PM10 a nivel
 * del suelo, ahora y en las próximas 24 horas. Una hora de caché.
 */

export type AirNow = {
  /** Hora del dato (ms, UTC). */
  time: number;
  pm25: number | null; pm10: number | null;
  /** Promedio y máximo de PM2,5 en las próximas 24 horas (µg/m³). */
  pm25Mean24: number | null; pm25Max24: number | null;
  /** Espesor óptico total de aerosoles (550 nm), ahora. */
  aod: number | null;
};

type R = {
  utc_offset_seconds: number;
  current?: { time: string; pm2_5: number | null; pm10: number | null; aerosol_optical_depth: number | null };
  hourly?: { time: string[]; pm2_5: (number | null)[] };
};

async function load(lat: number, lon: number): Promise<AirNow> {
  const u = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&domains=cams_global&timezone=GMT`
    + '&current=pm2_5,pm10,aerosol_optical_depth&hourly=pm2_5&forecast_days=2';
  const res = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`open-meteo air: HTTP ${res.status}`);
  const j = (await res.json()) as R;
  const now = Date.parse(`${j.current?.time ?? ''}Z`);
  const next = (j.hourly?.time ?? []).map((t, i) => [Date.parse(`${t}Z`), j.hourly!.pm2_5[i]] as const)
    .filter(([t, v]) => t >= now && t < now + 24 * 3600_000 && v != null).map(([, v]) => v as number);
  const r1 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 10) / 10);
  return {
    time: Number.isFinite(now) ? now : Date.now(),
    pm25: r1(j.current?.pm2_5), pm10: r1(j.current?.pm10),
    pm25Mean24: next.length ? r1(next.reduce((a, b) => a + b, 0) / next.length) : null,
    pm25Max24: next.length ? r1(Math.max(...next)) : null,
    aod: j.current?.aerosol_optical_depth ?? null,
  };
}

/** Aire en el punto (redondeado a 0,1°: la grilla de CAMS es de ~40 km). */
export async function airNow(lat: number, lon: number) {
  const la = Math.round(lat * 10) / 10, lo = Math.round(lon * 10) / 10;
  return (await kvCached(`air:v1:${la}:${lo}`, 3600_000, () => load(la, lo))).value;
}
