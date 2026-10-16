import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { fmtNum, fmtTime } from '@/lib/format';
import { METHOD, T, isLang } from '@/lib/i18n';
import { lastRuns } from '@/lib/server/db';
import type { SourceKey } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ lang: string }> };

const SOURCES: { k: SourceKey; name: string; url: string }[] = [
  { k: 'usgs', name: 'USGS ComCat', url: 'https://earthquake.usgs.gov/fdsnws/event/1/' },
  { k: 'eonet', name: 'NASA EONET v3', url: 'https://eonet.gsfc.nasa.gov/' },
  { k: 'gdacs', name: 'GDACS', url: 'https://www.gdacs.org/' },
  { k: 'gvp', name: 'Smithsonian GVP', url: 'https://volcano.si.edu/' },
  { k: 'carto', name: 'PB2002 (Bird, 2003)', url: 'https://github.com/fraxen/tectonicplates' },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = T[lang];
  return {
    title: `${t.method} · ${t.brand}`,
    description: t.methodMeta,
    alternates: { canonical: `/${lang}/metodologia`, languages: { es: '/es/metodologia', en: '/en/metodologia' } },
  };
}

/** Metodología pública (README §6): el texto completo y el estado de cada fuente. */
export default async function MethodPage({ params }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = T[lang];
  const runs = await lastRuns().catch(() => ({}) as Awaited<ReturnType<typeof lastRuns>>);
  const lastOk = Math.max(0, ...Object.values(runs).map((r) => r?.lastOkAt ?? 0));

  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: '/es/metodologia', en: '/en/metodologia' }} current="method" updatedAt={lastOk || undefined} />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.method}</span>
          <h1 className="ed-headline">{t.methodSub}</h1>
        </div>
        <div className="ed-prose">
          {METHOD[lang].map((m) => (
            <section key={m.h}>
              <h2>{m.h}</h2>
              <p>{m.p}</p>
            </section>
          ))}
          <section aria-labelledby="src-status">
            <h2 id="src-status">{t.dataStatus}</h2>
            <div className="ed-table-wrap">
              <table className="ed-table ed-sources-table">
                <thead>
                  <tr><th scope="col">{t.sourceLine}</th><th scope="col">{t.f.status}</th><th scope="col">{t.lastIngest}</th><th scope="col">{t.fetched}</th></tr>
                </thead>
                <tbody>
                  {SOURCES.map((s) => {
                    const r = runs[s.k];
                    return (
                      <tr key={s.k}>
                        <td><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></td>
                        <td className={r && !r.last.ok ? 'red' : undefined}>{r ? (r.last.ok ? t.ok : t.err) : '—'}</td>
                        <td>{r?.lastOkAt ? fmtTime(lang, r.lastOkAt) : '—'}</td>
                        <td>{r ? fmtNum(lang, r.last.fetched) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
