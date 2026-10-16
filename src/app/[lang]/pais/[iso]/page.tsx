import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { Corners } from '@/components/Corners';
import { CountryGlobe } from '@/components/CountryGlobe';
import { Glyph } from '@/components/Glyph';
import { PeriodNav, parseStatRange, periodLabel } from '@/components/PeriodNav';
import { SiteHeader } from '@/components/SiteHeader';
import { countryName, isIso3 } from '@/lib/countries';
import { fmtNum, fmtTime } from '@/lib/format';
import { T, isLang } from '@/lib/i18n';
import { parseYear } from '@/lib/range';
import { SHAPE, alertLevel } from '@/lib/symbols';
import { countryShape } from '@/lib/server/countries';
import { RANK_TYPES, getCountry } from '@/lib/server/stats';
import type { Lang } from '@/lib/types';

export const dynamic = 'force-dynamic';

const LIST_MAX = 50;

type SP = { range?: string; year?: string };
type Props = { params: Promise<{ lang: string; iso: string }>; searchParams: Promise<SP> };

const qs = (sp: Record<string, string | undefined>) => {
  const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang, iso } = await params;
  if (!isLang(lang) || !isIso3(iso)) return {};
  const sp = await searchParams;
  const t = T[lang];
  const range = parseStatRange(sp.range);
  const year = parseYear(sp.year);
  const name = countryName(iso, lang);
  const period = periodLabel(lang, range, year);
  const q = qs({ range: range === '1y' ? undefined : range, year: range === 'year' ? String(year) : undefined });
  const path = (l: Lang) => `/${l}/pais/${iso.toLowerCase()}${q}`;
  return {
    title: `${name} · ${period} · ${t.brand}`,
    description: t.countryMeta(name, period),
    alternates: { canonical: path(lang), languages: { es: path('es'), en: path('en') } },
    openGraph: { title: `${name} · ${t.brand}`, description: t.countryMeta(name, period), type: 'website' },
  };
}

export default async function CountryPage({ params, searchParams }: Props) {
  const { lang, iso } = await params;
  if (!isLang(lang) || !isIso3(iso)) notFound();
  const sp = await searchParams;
  if (iso !== iso.toLowerCase()) permanentRedirect(`/${lang}/pais/${iso.toLowerCase()}${qs({ range: sp.range, year: sp.year })}`);
  const iso3 = iso.toUpperCase();
  const t = T[lang];
  const range = parseStatRange(sp.range);
  const year = parseYear(sp.year);
  const keep = { range: range === '1y' ? undefined : range, year: range === 'year' ? String(year) : undefined };
  const { events, stats, position } = await getCountry(iso3, range, year);
  const shape = countryShape(iso3);
  const name = countryName(iso3, lang);
  const nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const period = periodLabel(lang, range, year);
  const list = events.slice(0, LIST_MAX);

  const kpis: { label: string; value: React.ReactNode; sub?: React.ReactNode }[] = [
    { label: t.col.alerts, value: nf(stats?.alerts ?? 0), sub: stats?.red ? t.redOf(stats.red) : t.alertsHelp },
    { label: t.col.total, value: nf(stats?.total ?? 0), sub: position.total ? `${t.posOf(position.total, position.of)} ${t.byTotal}` : undefined },
    { label: t.col.eq, value: nf(stats?.byType.eq ?? 0) },
    {
      label: t.col.maxmag,
      value: stats?.maxEq ? <Link href={`/${lang}/evento/${encodeURIComponent(stats.maxEq.id)}`}>M {nf(stats.maxEq.mag ?? 0, 1)}</Link> : '—',
      sub: stats?.maxEq ? fmtTime(lang, stats.maxEq.time, 'UTC') : undefined,
    },
  ];

  return (
    <div className="page">
      <SiteHeader lang={lang} langHrefs={{ es: `/es/pais/${iso}${qs(keep)}`, en: `/en/pais/${iso}${qs(keep)}` }} />
      <main className="content-page">
        <Link href={`/${lang}/ranking${qs(keep)}`} className="muted-12 back-link">← {t.rankTitle}</Link>
        <div className="page-head">
          <div className="stack-6">
            <span className="block-title">{t.countryKicker} · {iso3}</span>
            <h1 className="page-title">{name}</h1>
            {position.alerts && <p className="page-sub">{t.posOf(position.alerts, position.of)} {t.byAlerts} · {period}</p>}
          </div>
          <PeriodNav lang={lang} path={`/${lang}/pais/${iso}`} range={range} year={year} />
        </div>

        <div className="kpis">
          {kpis.map((k) => (
            <div key={k.label} className="card blueprint kpi">
              <Corners />
              <span className="block-title">{k.label}</span>
              <span className="kpi-value">{k.value}</span>
              {k.sub && <span className="muted-11">{k.sub}</span>}
            </div>
          ))}
        </div>

        <div className="country-grid">
          <div className="stack-10">
            {shape && <CountryGlobe shapes={shape.features} centroid={shape.centroid} events={events} label={name} />}
            <div className="stack-4">
              {RANK_TYPES.map((k) => (
                <div key={k} className="type-row">
                  <span className="glyph-cell"><Glyph shape={SHAPE[k]} /></span>
                  <span style={{ flex: 1 }}>{t.col[k]}</span>
                  <span className="tabular">{nf(stats?.byType[k] ?? 0)}</span>
                </div>
              ))}
            </div>
            <p className="note">{t.countryNote}</p>
          </div>

          <section className="stack-4" aria-labelledby="ev-list">
            <div className="row-between">
              <h2 id="ev-list" className="top-title" style={{ fontSize: 22 }}>{t.eventsList}</h2>
              {events.length > LIST_MAX && <span className="muted-12">{t.showing(LIST_MAX, events.length)}</span>}
            </div>
            {list.length === 0 && <p className="muted-13">{t.noData}</p>}
            {list.map((e) => {
              const lvl = alertLevel(e);
              return (
                <Link key={e.id} href={`/${lang}/evento/${encodeURIComponent(e.id)}`} className="list-row top-row link-row">
                  <span className="top-mag">{e.type === 'eq' && e.mag != null ? nf(e.mag, 1) : ''}</span>
                  <span className="stack-3" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, lineHeight: 1.3 }}>{e.title}</span>
                    <span className="muted-11 inline-6">
                      <Glyph shape={SHAPE[e.type]} kind={lvl >= 3 ? 'dark' : lvl === 2 ? 'solid' : ''} />
                      {[t.T1[e.type], fmtTime(lang, e.time, 'UTC'), e.alert ? `GDACS ${e.alert}` : e.pager ? `PAGER ${e.pager}` : '', e.src].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              );
            })}
          </section>
        </div>
      </main>
      <footer className="site-footer"><span>{t.carto}</span></footer>
    </div>
  );
}
