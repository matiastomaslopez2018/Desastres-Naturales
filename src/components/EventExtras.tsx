'use client';

import { useEffect, useState } from 'react';
import { geoDistance } from 'd3-geo';
import { T } from '@/lib/i18n';
import { fmtNum, fmtTime } from '@/lib/format';
import { alertLevel } from '@/lib/symbols';
import type { DisasterEvent, EmscMatch, Lang, TsunamiMessage } from '@/lib/types';

/*
 * Bloques de segundas fuentes bajo la ficha de un evento (Fase 2 · B):
 *  - Centros de alerta de tsunami NOAA (NTWC/PTWC) cuyos mensajes coinciden con el sismo.
 *  - EMSC: magnitud de una segunda agencia y testimonios "lo sentí".
 *  - ReliefWeb (ONU OCHA): reportes humanitarios para eventos con alerta naranja/roja o M6+.
 */

type Relief = { reports: { title: string; source: string; date: number; url: string }[] | null; searchUrl: string };

/** Mensajes NOAA que corresponden a un sismo: ±2 h y menos de 300 km (mismo criterio que el servidor). */
export const tsunamiFor = (e: Pick<DisasterEvent, 'lon' | 'lat' | 'time'>, msgs: TsunamiMessage[]) =>
  msgs.filter((m) => m.lat != null && m.lon != null && Math.abs(m.issued - e.time) < 2 * 36e5
    && geoDistance([m.lon, m.lat], [e.lon, e.lat]) * 6371 < 300);

export const wantsRelief = (e: DisasterEvent) => alertLevel(e) >= 2 || (e.type === 'eq' && (e.mag ?? 0) >= 6);

export function EventExtras({ lang, e, tsunami }: { lang: Lang; e: DisasterEvent; tsunami: TsunamiMessage[] | null }) {
  const t = T[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const [emsc, setEmsc] = useState<EmscMatch | null | undefined>(undefined);
  const [relief, setRelief] = useState<Relief | null>(null);
  const isUsgsEq = e.type === 'eq' && e.src === 'USGS';

  useEffect(() => {
    if (!isUsgsEq) return;
    setEmsc(undefined);
    const ctrl = new AbortController();
    const p = new URLSearchParams({ time: String(e.time), lat: String(e.lat), lon: String(e.lon), ...(e.mag != null ? { mag: String(e.mag) } : {}) });
    fetch(`/api/emsc?${p}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { match: EmscMatch | null }) => setEmsc(j.match))
      .catch(() => { if (!ctrl.signal.aborted) setEmsc(null); });
    return () => ctrl.abort();
  }, [isUsgsEq, e.time, e.lat, e.lon, e.mag]);

  useEffect(() => {
    setRelief(null);
    if (!wantsRelief(e)) return;
    const ctrl = new AbortController();
    const text = e.country || e.title;
    const p = new URLSearchParams({ ...(e.glide ? { glide: e.glide } : { text }), from: String((e.start ?? e.time) - 864e5) });
    fetch(`/api/reliefweb?${p}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: Relief) => setRelief(j))
      .catch(() => {});
    return () => ctrl.abort();
  }, [e]);

  const msgs = e.type === 'eq' && tsunami ? tsunamiFor(e, tsunami) : [];

  return (
    <>
      {msgs.length > 0 && (
        <section className="ev-extra">
          <h3 className="ev-extra-title">{t.tsunamiCenters}</h3>
          {msgs.map((m) => (
            <div key={m.id} className={`ev-extra-row${['warning', 'advisory', 'watch'].includes(m.level) ? ' hot' : ''}`}>
              <strong>{t.tsunamiLevel[m.level]}</strong> · {t.tsunamiCenterName[m.center] ?? m.center}
              <br /><span className="faint small">{m.region} · {fmtTime(lang, m.issued, 'UTC')}</span>
              <br /><a href={m.url} target="_blank" rel="noopener noreferrer" className="ev-link">{t.tsunamiBulletin} <span aria-hidden="true">↗</span></a>
            </div>
          ))}
        </section>
      )}

      {isUsgsEq && emsc !== undefined && (
        <section className="ev-extra">
          <h3 className="ev-extra-title">{t.emscTitle}</h3>
          {emsc ? (
            <>
              <dl className="ev-facts">
                {emsc.mag != null && <><dt>{t.emscMag}</dt><dd>{nf(emsc.mag, 1)} {emsc.magType}{e.mag != null && <span className="faint"> · USGS {nf(e.mag, 1)}</span>}</dd></>}
                {emsc.felt != null && emsc.felt > 0 && <><dt>{t.emscFelt}</dt><dd>{t.emscFeltN(emsc.felt)}</dd></>}
              </dl>
              <p className="ev-note">{t.emscDist(Math.round(emsc.distanceKm), Math.round(Math.abs(emsc.time - e.time) / 1000))}</p>
              <a href={emsc.url} target="_blank" rel="noopener noreferrer" className="ev-link">{t.emscLink} <span aria-hidden="true">↗</span></a>
            </>
          ) : <p className="ev-note">{t.emscNone}</p>}
        </section>
      )}

      {relief && (
        <section className="ev-extra">
          <h3 className="ev-extra-title">{t.reliefTitle}</h3>
          {relief.reports?.slice(0, 4).map((r) => (
            <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="ev-extra-row ev-relief">
              <span>{r.title}</span>
              <span className="faint small">{r.source} · {fmtTime(lang, r.date, 'UTC').split(' · ')[0]}</span>
            </a>
          ))}
          <a href={relief.searchUrl} target="_blank" rel="noopener noreferrer" className="ev-link">{t.reliefSearch} <span aria-hidden="true">↗</span></a>
        </section>
      )}
    </>
  );
}
