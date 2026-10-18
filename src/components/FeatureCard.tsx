'use client';

import { Glyph } from './Glyph';
import { MediaFigure } from './MediaFigure';
import { T } from '@/lib/i18n';
import { landslideCategory, landslideTrigger } from '@/lib/landslideText';
import { fmtCoords, fmtNum, fmtTime } from '@/lib/format';
import type { DartBuoy, GlcSlide, SpcReport } from '@/lib/mapTypes';
import type { HeatBin, HistTrack, Lang, Link, NhcStorm, VolcanoActivity } from '@/lib/types';

/*
 * Tarjeta de las capas de Fase 2 que no son eventos del catálogo:
 * ciclón activo (NHC), celda de focos FIRMS, volcán con actividad (GVP) y ciclón histórico (IBTrACS).
 * Mismo marcado que EventCard (ev-card) para que se vean igual.
 */

export type Feature = NhcStorm | HeatBin | VolcanoActivity | HistTrack | DartBuoy | SpcReport | GlcSlide;

type Props = { lang: Lang; f: Feature; onClose?(): void; actions?: React.ReactNode; onAnimate?(): void; animating?: boolean };

/** Escala Saffir-Simpson (definición oficial de NHC, viento sostenido 1 min en nudos). */
export const saffirSimpson = (kt: number | null) =>
  kt == null || kt < 64 ? null : kt >= 137 ? 5 : kt >= 113 ? 4 : kt >= 96 ? 3 : kt >= 83 ? 2 : 1;

const KT_KMH = 1.852, MPH_KMH = 1.609344;

/** Textos de las tarjetas de reportes de SPC y del catálogo de deslizamientos de NASA. */
const SEV = {
  es: {
    spcKicker: 'Reporte preliminar · NOAA SPC', time: 'Hora', ef: 'Escala EF', efUnk: 'sin evaluar todavía', gust: 'Ráfaga', hail: 'Granizo (diámetro)',
    county: 'Condado', comments: 'Comentario (original, en inglés)', spcLink: 'Reportes del Storm Prediction Center', nwsLink: 'Servicio Meteorológico Nacional (NWS)',
    spcNote: 'Reporte preliminar enviado al NWS por observadores, servicios de emergencia o el público. No está verificado: puede estar duplicado o mal ubicado. La intensidad EF de un tornado la asigna después el NWS con un relevamiento de daños.',
    glcKicker: 'Deslizamiento · NASA Global Landslide Catalog', death: 'muerte', deaths: 'muertes', date: 'Fecha', trigger: 'Causa según el catálogo', kind: 'Tipo', origTitle: 'Título original del catálogo (en inglés)', country: 'País',
    glcSource: 'Fuente citada por el catálogo', glcLink: 'NASA · Landslides',
    glcNote: 'Registro del catálogo de NASA, armado a partir de noticias e informes. La ubicación puede ser aproximada (a veces, el centro del pueblo o de la región).',
  },
  en: {
    spcKicker: 'Preliminary report · NOAA SPC', time: 'Time', ef: 'EF scale', efUnk: 'not rated yet', gust: 'Gust', hail: 'Hail (diameter)',
    county: 'County', comments: 'Comment (original)', spcLink: 'Storm Prediction Center reports', nwsLink: 'National Weather Service (NWS)',
    spcNote: 'Preliminary report sent to the NWS by spotters, emergency services or the public. It is unverified: it may be duplicated or misplaced. A tornado’s EF rating is assigned later by the NWS after a damage survey.',
    glcKicker: 'Landslide · NASA Global Landslide Catalog', death: 'death', deaths: 'deaths', date: 'Date', trigger: 'Trigger per the catalog', kind: 'Type', origTitle: 'Original catalog title', country: 'Country',
    glcSource: 'Source cited by the catalog', glcLink: 'NASA · Landslides',
    glcNote: 'Record from the NASA catalog, compiled from news and reports. The location may be approximate (sometimes the center of the town or region).',
  },
};
const ymd = (s: string | undefined) => (s && /^\d{8}$/.test(s) ? Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) : null);

export function FeatureCard({ lang, f, onClose, actions, onAnimate, animating }: Props) {
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
    const agency = f.agency ?? 'NHC';
    kicker = `${t.stormKicker} · ${agency === 'NHC' ? 'NOAA NHC' : `${agency} ${t.via} GDACS`}`;
    // Nombre según la región: huracán (Atlántico/Pacífico NE), tifón (Pacífico NO), ciclón (Índico/hemisferio sur).
    const strong = f.classification === 'HU' || f.classification === 'TY' || f.classification === 'TC';
    const cls = strong && f.basinWord ? t.basinWords[f.basinWord] : t.nhcClass[f.classification] ?? f.classification;
    title = `${cls} ${f.name}`;
    if (f.windKt != null) { big = nf(Math.round(f.windKt * KT_KMH)); bigUnit = `km/h · ${nf(f.windKt)} kt${agency === 'NHC' ? '' : ` · ${t.maxWindEvent}`}`; }
    const cat = agency === 'NHC' && f.classification === 'HU' ? saffirSimpson(f.windKt) : null;
    if (f.severityText) add(t.gdacsSeverity, f.severityText);
    if (cat) { add(t.nhcRows.cat, cat); lvl = cat >= 3 ? 3 : 2; }
    add(t.nhcRows.pressure, f.pressureMb != null ? `${nf(f.pressureMb)} hPa` : null);
    add(t.nhcRows.movement, f.movementDir != null && f.movementSpeedMph != null
      ? `${nf(f.movementDir)}° · ${nf(Math.round(f.movementSpeedMph * MPH_KMH))} km/h (${nf(f.movementSpeedMph)} mph)` : null);
    add(t.nhcRows.updated, fmtTime(lang, f.lastUpdate, 'UTC'));
    add(t.nhcRows.coords, fmtCoords(lang, f.lat, f.lon));
    if (f.advisoryUrl) links.push({ label: t.nhcLinks.advisory, url: f.advisoryUrl });
    if (f.discussionUrl) links.push({ label: t.nhcLinks.discussion, url: f.discussionUrl });
    if (agency === 'NHC') links.push({ label: 'NOAA · National Hurricane Center', url: 'https://www.nhc.noaa.gov/' });
    if (f.reportUrl) links.push({ label: 'GDACS · report', url: f.reportUrl });
    if (agency === 'JTWC') links.push({ label: 'JTWC · Joint Typhoon Warning Center', url: 'https://www.metoc.navy.mil/jtwc/jtwc.html' });
    // Centro oficial de la OMM para la región (RSMC).
    if (f.basinWord === 'typhoon') links.push({ label: t.rsmc('JMA (RSMC Tokio)'), url: 'https://www.jma.go.jp/bosai/map.html#contents=typhoon' });
    if (f.basinWord === 'cyclone' && f.lat < 0 && f.lon > 90 && f.lon < 160) links.push({ label: t.rsmc('Bureau of Meteorology (Australia)'), url: 'https://www.bom.gov.au/cyclone/' });
    if (f.basinWord === 'cyclone' && f.lat < 0 && (f.lon >= 160 || f.lon < -120)) links.push({ label: t.rsmc('MetService / Fiji Met (Pacífico Sur)'), url: 'https://www.metservice.com/warnings/tropical-cyclone-activity' });
    note = `${t.nhcNote} ${agency === 'NHC' ? '' : t.agencyNote(agency)}`;
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
  } else if (f.type === 'spc') {
    const x = SEV[lang];
    kicker = x.spcKicker; shape = f.kind === 'tornado' ? 'triangle' : 'diamond'; glyph = 'storm';
    title = `${t.spcKinds[f.kind]} · ${f.title}`;
    if (f.kind === 'tornado') lvl = 3;
    add(x.time, fmtTime(lang, f.time, 'UTC'));
    // Magnitud según el tipo: escala EF (o UNK si todavía no se evaluó), viento en mph, granizo en centésimos de pulgada.
    const n = Number(f.magnitude);
    if (f.kind === 'tornado') add(x.ef, /^UNK$/i.test(f.magnitude) ? x.efUnk : f.magnitude);
    else if (f.kind === 'wind' && Number.isFinite(n)) add(x.gust, `${nf(Math.round(n * MPH_KMH))} km/h (${nf(n)} mph)`);
    else if (f.kind === 'hail' && Number.isFinite(n)) add(x.hail, `${nf((n / 100) * 2.54, 1)} cm (${nf(n / 100, 2)} in)`);
    add(x.county, `${f.county}, ${f.state}`);
    add(t.f.coords, fmtCoords(lang, f.lat, f.lon));
    add(x.comments, f.comments);
    links.push({ label: x.spcLink, url: 'https://www.spc.noaa.gov/climo/reports/' });
    links.push({ label: x.nwsLink, url: 'https://www.weather.gov/' });
    note = x.spcNote;
  } else if (f.type === 'glc') {
    const x = SEV[lang];
    kicker = x.glcKicker; shape = 'square'; glyph = 'flood'; lvl = f.deaths >= 100 ? 3 : f.deaths >= 10 ? 2 : 1;
    big = nf(f.deaths); bigUnit = f.deaths === 1 ? x.death : x.deaths;
    add(x.date, f.time != null ? day(f.time) : null);
    add(x.kind, landslideCategory(lang, f.category));
    add(x.trigger, landslideTrigger(lang, f.trigger));
    add(x.country, f.country);
    add(t.f.coords, fmtCoords(lang, f.lat, f.lon));
    if (f.link) links.push({ label: x.glcSource, url: f.link });
    links.push({ label: x.glcLink, url: 'https://landslides.nasa.gov/' });
    note = x.glcNote;
  } else if (f.type === 'dart') {
    kicker = t.dartKicker; shape = 'diamond'; glyph = 'tsunami';
    title = f.title || `DART ${f.id}`;
    add(t.dartRows.station, f.id);
    add(t.dartRows.status, f.reporting ? t.dartOn : t.dartOff);
    add(t.dartRows.owner, f.owner);
    add(t.f.coords, fmtCoords(lang, f.lat, f.lon));
    links.push({ label: t.dartLink, url: `https://www.ndbc.noaa.gov/station_page.php?station=${f.id}` });
    note = t.dartNote;
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
      {f.type === 'nhc' && f.agency === 'NHC' && <MediaFigure lang={lang} q={{ storm: f.id }} />}
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
      <h2 className={f.type === 'glc' ? 'ev-title ev-title-1' : 'ev-title'} title={f.type === 'glc' ? `${SEV[lang].origTitle}: ${title}` : undefined}>{title}</h2>
      <dl className="ev-facts">
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'contents' }}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      {f.type === 'nhc' && onAnimate && ((f.pastPoints?.length ?? 0) > 1) && (
        <button className="anim-btn" onClick={onAnimate} aria-pressed={!!animating}>{animating ? t.animStop : t.animTrack}</button>
      )}
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
