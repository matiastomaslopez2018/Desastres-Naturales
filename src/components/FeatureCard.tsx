'use client';

import { Glyph } from './Glyph';
import { MediaFigure } from './MediaFigure';
import { T } from '@/lib/i18n';
import { fmtCoords, fmtNum, fmtTime } from '@/lib/format';
import type { HeatBin, HistTrack, Lang, Link, NhcStorm, VolcanoActivity } from '@/lib/types';

/*
 * Tarjeta de las capas de Fase 2 que no son eventos del catálogo:
 * ciclón activo (NHC), celda de focos FIRMS, volcán con actividad (GVP) y ciclón histórico (IBTrACS).
 * Mismo marcado que EventCard (ev-card) para que se vean igual.
 */

export type Feature = NhcStorm | HeatBin | VolcanoActivity | HistTrack;

type Props = { lang: Lang; f: Feature; onClose?(): void; actions?: React.ReactNode };

/** Escala Saffir-Simpson (definición oficial de NHC, viento sostenido 1 min en nudos). */
export const saffirSimpson = (kt: number | null) =>
  kt == null || kt < 64 ? null : kt >= 137 ? 5 : kt >= 113 ? 4 : kt >= 96 ? 3 : kt >= 83 ? 2 : 1;

const KT_KMH = 1.852, MPH_KMH = 1.609344;
const ymd = (s: string | undefined) => (s && /^\d{8}$/.test(s) ? Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) : null);

export function FeatureCard({ lang, f, onClose, actions }: Props) {
  const t = T[lang], nf = (x: number, dg = 0) => fmtNum(lang, x, dg);
  const rows: { label: string; value: string }[] = [];
  const links: Link[] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value != null && value !== '') rows.push({ label, value: String(value) });
  };
  const day = (ms: number) => fmtTime(lang, ms, 'UTC').split(' · ')[0];
  let kicker = '', big = '', bigUnit = '', title = f.title, note = '';
  let shape: 'square' | 'diamond' | 'triangle' = 'square', glyph = 'storm', lvl = 0;

  if (f.type === 'nhc') {
    kicker = t.nhcKicker;
    const cls = t.nhcClass[f.classification] ?? f.classification;
    title = `${cls} ${f.name}`;
    if (f.windKt != null) { big = nf(Math.round(f.windKt * KT_KMH)); bigUnit = `km/h · ${nf(f.windKt)} kt`; }
    const cat = f.classification === 'HU' ? saffirSimpson(f.windKt) : null;
    if (cat) { add(t.nhcRows.cat, cat); lvl = cat >= 3 ? 3 : 2; }
    add(t.nhcRows.pressure, f.pressureMb != null ? `${nf(f.pressureMb)} hPa` : null);
    add(t.nhcRows.movement, f.movementDir != null && f.movementSpeedMph != null
      ? `${nf(f.movementDir)}° · ${nf(Math.round(f.movementSpeedMph * MPH_KMH))} km/h (${nf(f.movementSpeedMph)} mph)` : null);
    add(t.nhcRows.updated, fmtTime(lang, f.lastUpdate, 'UTC'));
    add(t.nhcRows.coords, fmtCoords(lang, f.lat, f.lon));
    if (f.advisoryUrl) links.push({ label: t.nhcLinks.advisory, url: f.advisoryUrl });
    if (f.discussionUrl) links.push({ label: t.nhcLinks.discussion, url: f.discussionUrl });
    links.push({ label: 'NOAA · National Hurricane Center', url: 'https://www.nhc.noaa.gov/' });
    note = t.nhcNote;
  } else if (f.type === 'heat') {
    kicker = t.heatKicker; shape = 'diamond'; glyph = 'fire';
    big = nf(f.count); bigUnit = t.heatUnit(f.count).replace(/^\S+\s/, '');
    title = fmtCoords(lang, f.lat, f.lon);
    add(t.heatRows.frpMax, `${nf(f.frpMax, 1)} MW`);
    add(t.heatRows.frpSum, `${nf(f.frpSum, 1)} MW`);
    add(t.heatRows.last, fmtTime(lang, f.last, 'UTC'));
    add(t.heatRows.cell, fmtCoords(lang, f.lat, f.lon));
    links.push({ label: t.heatLink, url: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${f.lon.toFixed(2)},${f.lat.toFixed(2)},9.0z` });
    note = t.heatNote;
    if (f.frpMax >= 100) lvl = 2;
  } else if (f.type === 'wvolc') {
    kicker = t.volcKicker[f.origin]; shape = 'triangle'; glyph = 'volcano';
    if (f.status === 'new') lvl = 2;
    add(t.volcRows.status, t.volcStatus[f.status]);
    add(t.volcRows.country, f.country);
    const since = ymd(f.since);
    add(t.volcRows.since, since != null ? day(since) : null);
    add(t.volcRows.vei, f.vei);
    add(t.f.coords, fmtCoords(lang, f.lat, f.lon));
    if (/^erupt-\d+$/.test(f.id)) links.push({ label: t.volcPage, url: `/api/volcano-link?vn=${f.id.slice(6)}&lang=${lang}` });
    links.push({ label: t.volcLinks.gvp, url: f.gvpUrl });
    if (f.origin === 'weekly') links.push({ label: t.volcLinks.weekly, url: 'https://volcano.si.edu/reports_weekly.cfm' });
    note = f.report ?? '';
  } else {
    kicker = t.trackKicker;
    title = f.name ? `${f.name} (${f.season})` : `${t.unnamed} (${f.season})`;
    if (f.windKt != null) { big = nf(Math.round(f.windKt * KT_KMH)); bigUnit = `km/h · ${nf(f.windKt)} kt`; }
    add(t.trackRows.basin, t.basins[f.basin] ?? f.basin);
    add(t.trackRows.season, f.season);
    add(t.trackRows.dates, `${day(f.start)} – ${day(f.end)}`);
    add(t.trackRows.pressure, f.pressureMb != null ? `${nf(f.pressureMb)} hPa` : null);
    add(t.f.track, nf(f.points.length));
    links.push({ label: t.trackLink, url: `https://ncics.org/ibtracs/index.php?name=v04r01-${f.id.replace(/^ibtracs-/, '')}` });
    note = t.trackNote;
  }

  return (
    <article className="ev-card">
      {f.type === 'nhc' && <MediaFigure lang={lang} q={{ storm: f.id }} />}
      {f.type === 'wvolc' && /^erupt-\d+$/.test(f.id) && <MediaFigure lang={lang} q={{ volcano: +f.id.slice(6) }} />}
      <div className="ev-kicker">
        <Glyph shape={shape} type={glyph} alert={lvl} /> <span>{kicker}</span>
        {onClose && <button className="ev-close" onClick={onClose}>{t.close} ✕</button>}
      </div>
      {big && (
        <div className="ev-big">
          <span className="ev-big-num">{big}</span>
          <span className="ev-big-unit">{bigUnit}</span>
        </div>
      )}
      <h2 className="ev-title">{title}</h2>
      <dl className="ev-facts">
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'contents' }}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="ev-note">{note}</p>}
      <div className="ev-sources">
        <span className="ev-sources-title">{t.sources}</span>
        {links.map((l) => (
          <a key={l.url + l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="ev-link">
            {l.label} <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
      {actions}
    </article>
  );
}
