import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { CountryGlobe } from '@/components/CountryGlobe';
import { Glyph } from '@/components/Glyph';
import { PeriodNav, parseStatRange, periodLabel, periodPhrase } from '@/components/PeriodNav';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { ShareButtons } from '@/components/ShareButtons';
import { countryName, isIso3 } from '@/lib/countries';
import { fmtNum, fmtTime } from '@/lib/format';
import { T, isLang } from '@/lib/i18n';
import { parseYear } from '@/lib/range';
import { SHAPE, alertLevel, isHighlighted } from '@/lib/symbols';
import { countryShape } from '@/lib/server/countries';
import { alertTag, localTitle } from '@/lib/localize';
import { RANK_TYPES, getCountry } from '@/lib/server/stats';
import type { Lang } from '@/lib/types';

export const dynamic = 'force-dynamic';
// Un período que todavía no está en la base se trae de las fuentes en el momento.
export const maxDuration = 60;

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
  const { events, stats, position, fetchedAt } = await getCountry(iso3, range, year);
  const shape = countryShape(iso3);
  const name = countryName(iso3, lang);
  const nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const list = events.slice(0, LIST_MAX);

  const nEq = stats?.byType.eq ?? 0;
  const phrase = periodPhrase(lang, range, year);
  const headline = nEq
    ? t.countryLead(name, nf(nEq), phrase)
    : stats?.total ? t.countryLeadOther(name, nf(stats.total), phrase) : t.countryLeadNone(name, phrase);

  const figures: { label: string; value: React.ReactNode; sub?: React.ReactNode; red?: boolean }[] = [
    { label: t.col.alerts, value: nf(stats?.alerts ?? 0), sub: stats?.red ? t.redOf(stats.red) : t.alertsHelp, red: !!stats?.red },
    { label: t.col.total, value: nf(stats?.total ?? 0), sub: position.total ? `${t.posOf(position.total, position.of)} ${t.byTotal}` : undefined },
    { label: t.col.eq, value: nf(nEq) },
    {
      label: t.col.maxmag,
      value: stats?.maxEq ? <Link href={`/${lang}/evento/${encodeURIComponent(stats.maxEq.id)}`}>M {nf(stats.maxEq.mag ?? 0, 1)}</Link> : '—',
      sub: stats?.maxEq ? fmtTime(lang, stats.maxEq.time, 'UTC') : undefined,
      red: (stats?.maxEq?.mag ?? 0) >= 6,
    },
  ];

  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: `/es/pais/${iso}${qs(keep)}`, en: `/en/pais/${iso}${qs(keep)}` }} current="countries" updatedAt={fetchedAt} />
      <main className="ed-main">
        <div className="ed-head">
          <Link href={`/${lang}/ranking${qs(keep)}`} className="ed-back">← {t.rankTitle}</Link>
          <span className="ed-kicker">{name}{position.alerts ? ` · ${t.posOf(position.alerts, position.of)} ${t.byAlerts}` : ''}</span>
          <h1 className="ed-headline">{headline}</h1>
        </div>
        <div className="ed-head-row">
          <PeriodNav lang={lang} path={`/${lang}/pais/${iso}`} range={range} year={year} />
          <ShareButtons lang={lang} path={`/${lang}/pais/${iso}${qs(keep)}`} text={t.shareCountry(name)} />
        </div>

        <div className="ed-stats">
          {figures.map((k) => (
            <div key={k.label} className="ed-stat">
              <span className="ed-stat-label">{k.label}</span>
              <span className={`ed-stat-value${k.red ? ' red' : ''}`}>{k.value}</span>
              {k.sub && <span className="ed-stat-sub">{k.sub}</span>}
            </div>
          ))}
        </div>

        <div className="ed-grid">
          <div className="stack">
            {shape && <CountryGlobe shapes={shape.features} centroid={shape.centroid} events={events} label={name} />}
            <div>
              {RANK_TYPES.map((k) => (
                <div key={k} className="ed-type-row">
                  <Glyph shape={SHAPE[k]} type={k} />
                  <span className="row-between"><span>{t.col[k]}</span><strong className="tabular">{nf(stats?.byType[k] ?? 0)}</strong></span>
                </div>
              ))}
            </div>
            <p className="ed-note">{t.countryNote}</p>
          </div>

          <section aria-labelledby="ev-list">
            <div className="row-between" style={{ alignItems: 'baseline' }}>
              <h2 id="ev-list" className="ed-h3">{t.eventsList}</h2>
              {events.length > LIST_MAX && <span className="ed-note">{t.showing(LIST_MAX, events.length)}</span>}
            </div>
            {list.length === 0 && <p className="ed-note">{t.noData}</p>}
            {list.map((e) => (
              <Link key={e.id} href={`/${lang}/evento/${encodeURIComponent(e.id)}`} className="ed-list-row">
                <span className={`ed-list-mag${isHighlighted(e) ? ' red' : ''}`}>{e.type === 'eq' && e.mag != null ? nf(e.mag, 1) : ''}</span>
                <span className="ev-row-body">
                  <span className="ed-list-title">{localTitle(e, lang)}</span>
                  <span className="ed-list-meta row">
                    <Glyph shape={SHAPE[e.type]} type={e.type} alert={alertLevel(e)} size={12} />
                    {[t.T1[e.type], fmtTime(lang, e.time, 'UTC'), alertTag(e, lang), e.src].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </Link>
            ))}
          </section>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
