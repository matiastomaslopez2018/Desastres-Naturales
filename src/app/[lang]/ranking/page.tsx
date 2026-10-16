import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Glyph } from '@/components/Glyph';
import { PeriodNav, parseStatRange, periodLabel } from '@/components/PeriodNav';
import { SiteHeader } from '@/components/SiteHeader';
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
  const { stats, sources } = await getRanking(range, year);
  const rows = rank(stats.values(), sort);
  const nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const keep = { range: range === '1y' ? undefined : range, year: range === 'year' ? String(year) : undefined };
  const sortHref = (k: SortKey) => `/${lang}/ranking${qs({ ...keep, orden: k === 'alerts' ? undefined : k })}`;
  const langHref = (l: Lang) => `/${l}/ranking${qs({ ...keep, orden: sort === 'alerts' ? undefined : sort })}`;
  const failing = Object.entries(sources).filter(([, s]) => s?.state === 'err').map(([k]) => k.toUpperCase());

  const head = (k: SortKey, label: React.ReactNode, title?: string) => (
    <th key={k} scope="col" className={k === sort ? 'sorted' : undefined} aria-sort={k === sort ? 'descending' : undefined} title={title}>
      <Link href={sortHref(k)} scroll={false}>{label}{k === sort ? ' ↓' : ''}</Link>
    </th>
  );

  return (
    <div className="page">
      <SiteHeader lang={lang} langHrefs={{ es: langHref('es'), en: langHref('en') }} current="ranking" />
      <main className="content-page">
        <div className="page-head">
          <div className="stack-6">
            <h1 className="page-title">{t.rankTitle}</h1>
            <p className="page-sub">{t.rankSub}</p>
          </div>
          <PeriodNav lang={lang} path={`/${lang}/ranking`} range={range} year={year} params={sort === 'alerts' ? {} : { orden: sort }} />
        </div>

        {failing.length > 0 && <p className="alert-box alert-text" role="status">{t.err}: {failing.join(', ')}</p>}

        {rows.length === 0 ? (
          <p className="muted-13">{t.noData}</p>
        ) : (
          <div className="table-wrap">
            <table className="table rank-table">
              <caption className="sr-only">{t.rankTitle} · {periodLabel(lang, range, year)}</caption>
              <thead>
                <tr>
                  <th scope="col" className="num">{t.col.pos}</th>
                  <th scope="col">{t.col.country}</th>
                  {head('alerts', t.col.alerts, t.alertsHelp)}
                  {head('total', t.col.total)}
                  {head('maxmag', t.col.maxmag)}
                  {RANK_TYPES.map((k) => head(k, <span className="inline-6"><Glyph shape={SHAPE[k]} />{t.col[k]}</span>))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <tr key={s.iso3}>
                    <td className="num muted">{i + 1}</td>
                    <th scope="row"><Link href={countryPath(lang, s.iso3) + qs(keep)}>{countryName(s.iso3, lang)}</Link></th>
                    <td className="num">{s.alerts ? <>{nf(s.alerts)}{s.red ? <span className="muted"> · {t.redOf(s.red)}</span> : null}</> : <span className="muted">0</span>}</td>
                    <td className="num">{nf(s.total)}</td>
                    <td className="num">
                      {s.maxEq ? <Link href={`/${lang}/evento/${encodeURIComponent(s.maxEq.id)}`}>M {nf(s.maxEq.mag ?? 0, 1)}</Link> : <span className="muted">—</span>}
                    </td>
                    {RANK_TYPES.map((k) => <td key={k} className="num">{s.byType[k] ? nf(s.byType[k]) : <span className="muted">0</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="note page-note">{t.rankNote}</p>
      </main>
      <footer className="site-footer"><span>{t.carto}</span></footer>
    </div>
  );
}

