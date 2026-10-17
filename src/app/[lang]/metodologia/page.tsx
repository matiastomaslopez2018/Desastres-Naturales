import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { fmtNum, fmtTime } from '@/lib/format';
import { METHOD, T, isLang } from '@/lib/i18n';
import { INTERPRETATIONS, METHOD_GROUPS } from '@/lib/methodSources';
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

const LBL = {
  es: {
    detail: 'Fuentes en detalle', detailIntro: 'Qué cubre cada fuente, cada cuánto se actualiza (y cada cuánto la consulta este sitio), su licencia y sus limitaciones.',
    covers: 'Qué cubre', freq: 'Actualización', license: 'Licencia', limits: 'Limitaciones',
    interp: 'Interpretaciones', interpIntro: 'Estos datos los calcula el sitio a partir de fuentes oficiales; no son publicados por ellas. En cada ficha aparecen rotulados como interpretación.',
  },
  en: {
    detail: 'Sources in detail', detailIntro: 'What each source covers, how often it updates (and how often this site queries it), its license and its limitations.',
    covers: 'Coverage', freq: 'Updates', license: 'License', limits: 'Limitations',
    interp: 'Interpretations', interpIntro: 'These values are computed by this site from official sources; they are not published by them. Each page labels them as an interpretation.',
  },
};

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
  const t = T[lang], L = LBL[lang];
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
          <section aria-labelledby="src-detail">
            <h2 id="src-detail">{L.detail}</h2>
            <p>{L.detailIntro}</p>
            {METHOD_GROUPS.map((g) => (
              <div key={g.title.en} className="src-group">
                <h3>{g.title[lang]}</h3>
                {g.sources.map((s) => (
                  <article key={s.name} className="src-card">
                    <h4><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></h4>
                    <dl>
                      <dt>{L.covers}</dt><dd>{s.covers[lang]}</dd>
                      <dt>{L.freq}</dt><dd>{s.freq[lang]}</dd>
                      <dt>{L.license}</dt><dd>{s.license[lang]}</dd>
                      <dt>{L.limits}</dt><dd>{s.limits[lang]}</dd>
                    </dl>
                  </article>
                ))}
              </div>
            ))}
          </section>
          <section aria-labelledby="interp">
            <h2 id="interp">{L.interp}</h2>
            <p>{L.interpIntro}</p>
            {INTERPRETATIONS[lang].map((m) => (
              <div key={m.h} className="src-interp"><h3>{m.h}</h3><p>{m.p}</p></div>
            ))}
          </section>
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
