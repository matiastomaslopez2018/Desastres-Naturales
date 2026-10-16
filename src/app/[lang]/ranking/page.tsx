import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Glyph } from '@/components/Glyph';
import { PeriodNav, parseStatRange, periodLabel, periodPhrase } from '@/components/PeriodNav';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { countryName, countryPath } from '@/lib/countries';
import { fmtNum } from '@/lib/format';
import { T, isLang } from '@/lib/i18n';
import { parseYear } from '@/lib/range';
import { SHAPE } from '@/lib/symbols';
import { RANK_TYPES, getRanking, parseSort, rank, type SortKey } from '@/lib/server/stats';
import type { Lang } from '@/lib/types';

export const dynamic = 'force-dynamic';
// Un período que todavía no está en la base se trae de las fuentes en el momento.
export const maxDuration = 60;

type SP = { range?: string; year?: string; orden?: string };
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<SP> };

const qs = (sp: Record<string, string | undefined>) => {
  const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const sp = await searchParams;
  const t = T[lang];
  const range = parseStatRange(sp.range);
  const year = parseYear(sp.year);
  const period = periodLabel(lang, range, year);
  const q = qs({ range: range === '1y' ? undefined : range, year: range === 'year' ? String(year) : undefined });
  return {
    title: `${t.rankTitle} · ${period} · ${t.brand}`,
    description: t.rankMeta(period),
    alternates: { canonical: `/${lang}/ranking${q}`, languages: { es: `/es/ranking${q}`, en: `/en/ranking${q}` } },
    openGraph: { title: `${t.rankTitle} · ${t.brand}`, description: t.rankMeta(period), type: 'website' },
  };
}

export default async function RankingPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const t = T[lang];
  const range = parseStatRange(sp.range);
  const year = parseYear(sp.year);
  const sort = parseSort(sp.orden);
  const { stats, sources, fetchedAt } = await getRanking(range, year);
  const rows = rank(stats.values(), sort);
  const nf = (x: number, d = 0) => fmtNum(lang, x, d);
  /** "Incluye 673 incendios y 3 inundaciones": de qué está hecho el total. */
  const list = new Intl.ListFormat(lang, { type: 'conjunction' });
  const composition = (byType: Record<string, number>) =>
    t.includes(list.format(
      RANK_TYPES.filter((k) => byType[k]).sort((a, b) => byType[b] - byType[a])
        .map((k) => `${nf(byType[k])} ${t.comp[k][byType[k] === 1 ? 0 : 1]}`),
    ));
  const keep = { range: range === '1y' ? undefined : range, year: range === 'year' ? String(year) : undefined };
  const sortHref = (k: SortKey) => `/${lang}/ranking${qs({ ...keep, orden: k === 'alerts' ? undefined : k })}`;
  const langHref = (l: Lang) => `/${l}/ranking${qs({ ...keep, orden: sort === 'alerts' ? undefined : sort })}`;
  const failing = Object.entries(sources).filter(([, s]) => s?.state === 'err').map(([k]) => k.toUpperCase());

  const leader = rank(stats.values(), 'alerts')[0];
  const period = periodLabel(lang, range, year);
  const headline = leader ? t.rankLead(countryName(leader.iso3, lang), t.alertsN(leader.alerts), periodPhrase(lang, range, year)) : t.rankTitle;

  const head = (k: SortKey, label: React.ReactNode, title?: string) => (
    <th key={k} scope="col" className={k === sort ? 'sorted' : undefined} aria-sort={k === sort ? 'descending' : undefined} title={title}>
      <Link href={sortHref(k)} scroll={false}>{label}{k === sort ? ' ↓' : ''}</Link>
    </th>
  );

  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: langHref('es'), en: langHref('en') }} current="ranking" updatedAt={fetchedAt} />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.rankTitle}</span>
          <h1 className="ed-headline">{headline}</h1>
          <p className="ed-dek">{t.rankSub}</p>
        </div>
        <div className="ed-head-row">
          <PeriodNav lang={lang} path={`/${lang}/ranking`} range={range} year={year} params={sort === 'alerts' ? {} : { orden: sort }} />
          <span className="ed-note">{t.alertsHelp}</span>
        </div>

        {failing.length > 0 && <p className="ev-alert red" role="status">{t.err}: {failing.join(', ')}</p>}

        {rows.length === 0 ? (
          <p className="ed-note">{t.noData}</p>
        ) : (
          <div className="ed-table-wrap">
            <table className="ed-table">
              <caption className="sr-only">{t.rankTitle} · {period}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.col.pos}</th>
                  <th scope="col">{t.col.country}</th>
                  {head('alerts', t.col.alerts, t.alertsHelp)}
                  {head('total', t.col.total)}
                  {head('maxmag', t.col.maxmag)}
                  {RANK_TYPES.map((k) => head(k, <span className="row"><Glyph shape={SHAPE[k]} type={k} size={12} />{t.col[k]}</span>))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <tr key={s.iso3}>
                    <td className="pos">{i + 1}</td>
                    <th scope="row"><Link href={countryPath(lang, s.iso3) + qs(keep)}>{countryName(s.iso3, lang)}</Link></th>
                    <td>{s.alerts ? <>{nf(s.alerts)}{s.red ? <span className="red"> · {t.redOf(s.red)}</span> : null}</> : <span className="zero">0</span>}</td>
                    <td>
                      <span className="composition" title={composition(s.byType)} aria-label={`${nf(s.total)} · ${composition(s.byType)}`}>{nf(s.total)}</span>
                    </td>
                    <td>
                      {s.maxEq ? <Link href={`/${lang}/evento/${encodeURIComponent(s.maxEq.id)}`} className={(s.maxEq.mag ?? 0) >= 6 ? 'red' : undefined}>M {nf(s.maxEq.mag ?? 0, 1)}</Link> : <span className="zero">—</span>}
                    </td>
                    {RANK_TYPES.map((k) => <td key={k}>{s.byType[k] ? nf(s.byType[k]) : <span className="zero">0</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="ed-note">{t.rankNote}</p>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
