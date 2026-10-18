import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { T } from '@/lib/i18n';
import { ARTICLES, REVIEWED, articleBySlug, type Topic } from '@/lib/learn';
import { LearnFigure } from '@/components/landing/LearnFigure';

const TOPICS: Topic[] = ['eq', 'tsunami', 'volcano', 'storm', 'fire', 'flood', 'drought', 'landslide', 'severe', 'heat', 'general'];
const TOPIC_NAME: Record<Lang, Record<Topic, string>> = {
  es: { eq: 'Sismos', tsunami: 'Tsunamis', volcano: 'Volcanes', storm: 'Ciclones', fire: 'Incendios', flood: 'Inundaciones', drought: 'Sequías', landslide: 'Deslizamientos', severe: 'Tornados', heat: 'Calor y frío', general: 'General' },
  en: { eq: 'Earthquakes', tsunami: 'Tsunamis', volcano: 'Volcanoes', storm: 'Cyclones', fire: 'Wildfires', flood: 'Floods', drought: 'Droughts', landslide: 'Landslides', severe: 'Tornadoes', heat: 'Heat and cold', general: 'General' },
};
/** Mapa filtrado por el tipo del tema (?tipo= del globo). */
const MAP_TYPES = new Set<Topic>(['eq', 'tsunami', 'volcano', 'storm', 'fire', 'flood', 'drought']);
const mapFor = (lang: Lang, topic: Topic) => (MAP_TYPES.has(topic) ? `/${lang}?tipo=${topic}` : `/${lang}`);
import { jsonLd, routePath } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import type { Lang } from '@/lib/types';

const reviewed = (lang: Lang) => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(REVIEWED));

export const learnIndexMeta = (lang: Lang) => seoMeta(lang, 'learn', T[lang].learn.seoTitle, T[lang].learn.desc);

export function LearnIndex({ lang }: { lang: Lang }) {
  const t = T[lang].learn;
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'learn'), en: routePath('en', 'learn') }} current="learn" />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.title}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.desc}</p>
        </div>
        <nav className="learn-tabs" aria-label={t.title}>
          {TOPICS.map((k) => <a key={k} href={`#${k}`} className={`learn-tab t-${k}`}>{TOPIC_NAME[lang][k]}</a>)}
        </nav>
        {TOPICS.map((k) => (
          <section key={k} id={k} className={`learn-topic t-${k}`} aria-labelledby={`h-${k}`}>
            <div className="row-between">
              <h2 id={`h-${k}`} className="ed-h3">{TOPIC_NAME[lang][k]}</h2>
              {k !== 'general' && k !== 'heat' && <Link href={mapFor(lang, k)} className="ed-more">{t.onMap} →</Link>}
            </div>
            <div className="seo-grid">
              {ARTICLES.filter((a) => a.topic === k).map((a) => (
                <Link key={a.id} href={routePath(lang, 'learn', a[lang].slug)} className="seo-card">
                  <strong>{a[lang].title}</strong>
                  <span className="ed-note">{a[lang].desc}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
        <SeoLinks lang={lang} current="learn" />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}

export function learnMeta(lang: Lang, slug: string): Metadata {
  const a = articleBySlug(lang, slug);
  if (!a) return {};
  return seoMeta(lang, 'learn', a[lang].seoTitle, a[lang].desc, { es: a.es.slug, en: a.en.slug });
}

/** Para redirigir entre /es/aprender/… y /en/learn/…. */
export const learnSlugs = (lang: Lang, slug: string) => {
  const a = articleBySlug(lang, slug);
  return a ? { es: a.es.slug, en: a.en.slug } : undefined;
};

export function LearnArticle({ lang, slug }: { lang: Lang; slug: string }) {
  const a = articleBySlug(lang, slug);
  if (!a) notFound();
  const t = T[lang].learn, art = a[lang];
  const url = routePath(lang, 'learn', art.slug);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: art.seoTitle, description: art.desc, inLanguage: lang,
    url: SITE_URL + url, dateModified: REVIEWED, datePublished: REVIEWED,
    author: { '@type': 'Organization', name: T[lang].brand, url: SITE_URL },
    publisher: { '@type': 'Organization', name: T[lang].brand, url: SITE_URL },
    citation: a.sources.map((s) => s.url),
  };
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'learn', a.es.slug), en: routePath('en', 'learn', a.en.slug) }} current="learn" />
      <main className="ed-main">
        <div className="ed-head">
          <Link href={routePath(lang, 'learn')} className="ed-back">← {t.title}</Link>
          <h1 className="ed-headline">{art.title}</h1>
          <p className="ed-lead">{art.lead}</p>
          <p className="ed-note">{t.reviewed} {reviewed(lang)} · <span className={`learn-chip t-${a.topic}`}>{TOPIC_NAME[lang][a.topic]}</span>{a.topic !== 'general' && <> · <Link href={mapFor(lang, a.topic)}>{t.onMap} →</Link></>}</p>
        </div>
        {a.figures?.length ? <div className="learn-figs">{a.figures.map((f) => <LearnFigure key={f} lang={lang} f={f} />)}</div> : null}
        <article className="ed-prose">
          {art.sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              {s.p?.map((p) => <p key={p}>{p}</p>)}
              {s.list && <ul className="ed-list">{s.list.map((li) => <li key={li}>{li}</li>)}</ul>}
              {s.table && (
                <div className="ed-table-wrap">
                  <table className="ed-table learn-table">
                    <thead><tr>{s.table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                    <tbody>{s.table.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
          <section>
            <h2>{t.sources}</h2>
            <ul className="ed-list">
              {a.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a></li>)}
            </ul>
          </section>
          <section>
            <h2>{t.more}</h2>
            <ul className="ed-list">
              {ARTICLES.filter((x) => x.id !== a.id).map((x) => <li key={x.id}><Link href={routePath(lang, 'learn', x[lang].slug)}>{x[lang].title}</Link></li>)}
            </ul>
          </section>
        </article>
        <SeoLinks lang={lang} current="learn" />
      </main>
      <SiteFooter lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
    </div>
  );
}
