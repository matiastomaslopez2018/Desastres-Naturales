import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { countryName, countryPath } from '@/lib/countries';
import { fmtNum } from '@/lib/format';
import { T, isLang } from '@/lib/i18n';
import { getRanking } from '@/lib/server/stats';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = T[lang];
  return {
    title: `${t.countriesTitle} · ${t.brand}`,
    description: t.countriesMeta,
    alternates: { canonical: `/${lang}/paises`, languages: { es: '/es/paises', en: '/en/paises' } },
  };
}

/** Índice alfabético de países con eventos en el último año. */
export default async function CountriesPage({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = T[lang];
  const { stats, fetchedAt } = await getRanking('1y', new Date().getUTCFullYear());
  const collator = new Intl.Collator(lang);
  const rows = [...stats.values()]
    .map((s) => ({ ...s, name: countryName(s.iso3, lang) }))
    .sort((a, b) => collator.compare(a.name, b.name));
  const nf = (x: number) => fmtNum(lang, x);

  // Agrupado por inicial, como un índice.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const letter = r.name.normalize('NFD').charAt(0).toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), r]);
  }

  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: '/es/paises', en: '/en/paises' }} current="countries" updatedAt={fetchedAt} />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.countriesTitle}</span>
          <h1 className="ed-headline">{t.countriesSub}</h1>
        </div>
        <div className="ed-countries">
          {[...groups.entries()].map(([letter, list]) => (
            <div key={letter}>
              <div className="ed-letter">{letter}</div>
              {list.map((r) => (
                <Link key={r.iso3} href={countryPath(lang, r.iso3)} className="ed-country-row">
                  <span className="name">{r.name}</span>
                  <span className="num">
                    {r.alerts ? <span className="red">{t.alertsN(r.alerts)} · </span> : null}
                    {nf(r.total)}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
        <p className="ed-note">{t.rankNote}</p>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
