import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { T } from '@/lib/i18n';
import { ARTICLES, REVIEWED, articleBySlug } from '@/lib/learn';
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
        <div className="seo-grid">
          {ARTICLES.map((a) => (
            <Link key={a.id} href={routePath(lang, 'learn', a[lang].slug)} className="seo-card">
              <strong>{a[lang].title}</strong>
              <span className="ed-note">{a[lang].desc}</span>
            </Link>
          ))}
        </div>
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
          <p className="ed-note">{t.reviewed} {reviewed(lang)}</p>
        </div>
        <article className="ed-prose">
          {art.sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              {s.p?.map((p) => <p key={p}>{p}</p>)}
              {s.list && <ul className="ed-list">{s.list.map((li) => <li key={li}>{li}</li>)}</ul>}
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
