'use client';

import NextLink from 'next/link';
import { Glyph } from './Glyph';
import { Corners } from './Corners';
import type { Pickable } from './Globe';
import { countryName, countryPath } from '@/lib/countries';
import { T } from '@/lib/i18n';
import { fmtNum, fmtTime } from '@/lib/format';
import { SHAPE, alertLevel } from '@/lib/symbols';
import type { EqDetail, Lang, Link } from '@/lib/types';

type Props = {
  lang: Lang; e: Pickable; detail: EqDetail | null; detailLoading?: boolean;
  /** Sin `onClose` no se muestra "Cerrar" (ficha permalink). */
  onClose?(): void;
  actions?: React.ReactNode;
  titleAs?: 'h1' | 'h2';
};

export function EventCard({ lang, e, detail, detailLoading, onClose, actions, titleAs: Title = 'h2' }: Props) {
  const t = T[lang], f = t.f, d: Partial<EqDetail> = detail ?? {};
  const nf = (x: number, dg = 0) => fmtNum(lang, x, dg);
  const rows: { label: string; value: React.ReactNode }[] = [];
  const links: Link[] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value != null && value !== '') rows.push({ label, value: String(value) });
  };
  const addCountry = () => {
    if (e.type !== 'gvp' && e.iso3) rows.push({ label: f.country, value: <NextLink href={countryPath(lang, e.iso3)}>{countryName(e.iso3, lang)}</NextLink> });
    else add(f.country, e.country);
  };
  const pm = (v: number, err: number | null | undefined, unit: string, dg: number) =>
    nf(v, dg) + (err != null ? ` ± ${nf(err, dg)}` : '') + (unit ? ' ' + unit : '');
  const coords = (extra = '') => `${nf(e.lat, 3)}°, ${nf(e.lon, 3)}°${extra}`;

  let big = '', bigUnit = '', alertLabel = '', alertText = '';
  let kicker: string;
  let shape = SHAPE.volcano;
  let kind: '' | 'solid' | 'dark' = '';

  if (e.type === 'gvp') {
    kicker = `${t.gvpKicker} · GVP`;
    add(f.country, e.country);
    add(f.vtype, e.vtype);
    add(f.lastErup, e.lastErup != null ? (e.lastErup < 0 ? `${nf(-e.lastErup)} ${t.bce}` : e.lastErup) : null);
    add(f.coords, coords());
    links.push({ label: 'Smithsonian · Global Volcanism Program', url: `https://volcano.si.edu/volcano.cfm?vn=${e.num}` });
  } else {
    kicker = `${t.T[e.type]} · ${e.src}`;
    shape = SHAPE[e.type];
    const lvl = alertLevel(e);
    kind = lvl >= 3 ? 'dark' : lvl === 2 ? 'solid' : '';

    if (e.type === 'eq') {
      big = e.mag != null ? nf(e.mag, 1) : '—';
      bigUnit = (e.magType ?? '') + (d.magErr != null ? ` ± ${nf(d.magErr, 2)}` : '');
      add(f.place, e.title);
      addCountry();
      add(f.utc, fmtTime(lang, e.time, 'UTC'));
      add(f.local, fmtTime(lang, e.time));
      add(f.depth, e.depth != null ? pm(e.depth, d.vErr, 'km', 1) : null);
      add(f.coords, coords(d.hErr != null ? ` ± ${nf(d.hErr, 1)} km` : ''));
      add(f.status, e.status === 'reviewed' ? t.reviewed : e.status === 'automatic' ? t.automatic : e.status === 'deleted' ? t.deleted : e.status);
      if (e.tsunami) add(f.tsunami, t.yes);
      add(f.mmi, d.mmi != null ? nf(d.mmi, 1) : null);
      add(f.felt, d.dyfi != null ? nf(d.dyfi) : e.felt != null ? nf(e.felt) : null);
      add(f.stations, d.nst != null ? nf(d.nst) : null);
      add(f.gap, d.gap != null ? nf(d.gap) + '°' : null);
      if (e.src === 'USGS') add(f.net, `${(e.net ?? '').toUpperCase()} · ${e.id}`);
      if (e.pager) { alertLabel = t.pager; alertText = t.PAGER[e.pager] ?? e.pager; }
      if (e.src === 'USGS' && e.url) {
        links.push({ label: 'USGS · Earthquake Hazards Program', url: e.url });
        if (e.pager) links.push({ label: 'USGS PAGER', url: e.url + '/pager' });
      }
      if (e.tsunami) links.push({ label: 'NOAA · tsunami.gov', url: 'https://www.tsunami.gov/' });
    } else {
      if (e.mag != null) { big = nf(e.mag, e.mag % 1 ? 1 : 0); bigUnit = e.magUnit ?? ''; }
      addCountry();
      add(f.start, e.start ? fmtTime(lang, e.start, 'UTC') : fmtTime(lang, e.time, 'UTC'));
      add(f.end, e.src === 'NASA EONET' ? fmtTime(lang, e.time, 'UTC') : e.end ? fmtTime(lang, e.end, 'UTC') : null);
      add(f.local, fmtTime(lang, e.time));
      add(f.status, e.src === 'NASA EONET' ? (e.closed ? t.closed : t.open) : null);
      add(f.severity, e.severity);
      add(f.track, e.track ? nf(e.track.length) : null);
      add(f.coords, coords());
      for (const l of e.links ?? []) links.push(l);
      if (e.apiUrl) links.push({ label: 'NASA EONET (API)', url: e.apiUrl });
      if (e.src === 'GDACS' && e.url) links.push({ label: 'GDACS · report', url: e.url });
    }
    if (e.alert && t.GD[e.alert]) {
      alertLabel = t.gdacs;
      alertText = t.GD[e.alert] + (e.severity && e.type === 'eq' ? ' · ' + e.severity : '');
    }
    if (e.gdacsUrl) links.push({ label: 'GDACS · report', url: e.gdacsUrl });
  }

  return (
    <div className="card blueprint event-card">
      <Corners />
      <div className="row-between">
        <span className="card-kicker kicker">
          <Glyph shape={shape} kind={kind} /> {kicker}
        </span>
        {onClose && <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 12 }}>{t.close}</button>}
      </div>
      {big && (
        <div className="big-num">
          <span>{big}</span>
          <span className="muted-13">{bigUnit}</span>
        </div>
      )}
      <Title className="card-title event-title">{e.title}</Title>
      {alertText && (
        <div className="alert-box">
          <span className="alert-label">{alertLabel}</span>
          <span className="alert-text">{alertText}</span>
        </div>
      )}
      <dl className="facts">
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'contents' }}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      {detailLoading && <span className="muted-12">{t.loadingDetail}</span>}
      <div className="stack-6">
        <span className="block-title">{t.sources}</span>
        {links.filter((l) => l.url).map((l) => (
          <a key={l.url + l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="src-link">
            {l.label} <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
      {actions}
    </div>
  );
}
