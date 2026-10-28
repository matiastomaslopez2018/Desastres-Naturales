// Historias de grandes desastres: índice y cada historia con mapa que acompaña el scroll.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { StoryView } from '@/components/StoryView';
import { STORIES, storyBySlug } from '@/lib/stories';
import { routePath } from '@/lib/seo';
import type { Lang } from '@/lib/types';

const T = {
  es: {
    kicker: 'Historias', h1: 'Grandes desastres, contados paso a paso',
    seoTitle: 'Historias de grandes desastres: Valdivia 1960, Caucete 1977, Santa Fe 2003',
    desc: 'Qué pasó en los grandes terremotos e inundaciones de la región, contado paso a paso con mapas y datos oficiales: Valdivia 1960, Caucete 1977 y Santa Fe 2003.',
    lead: 'Qué pasó, por qué y qué dejó cada uno, con mapas que acompañan el relato y las fuentes de cada dato.',
    read: 'Leer la historia',
  },
  en: {
    kicker: 'Stories', h1: 'Great disasters, told step by step',
    seoTitle: 'Stories of great disasters: Valdivia 1960, Caucete 1977, Santa Fe 2003',
    desc: 'What happened in the region’s great earthquakes and floods, told step by step with maps and official data: Valdivia 1960, Caucete 1977 and Santa Fe 2003.',
    lead: 'What happened, why, and what each one left behind, with maps that follow the story and the source of every figure.',
    read: 'Read the story',
  },
};

export const storiesMeta = (lang: Lang) => seoMeta(lang, 'stories', T[lang].seoTitle, T[lang].desc);
export const storyMeta = (lang: Lang, slug: string) => {
  const s = storyBySlug(lang, slug);
  return s ? seoMeta(lang, 'stories', `${s.title} (${s.kicker})`, s.dek, { es: slug, en: slug }) : {};
};

export function StoriesIndex({ lang }: { lang: Lang }) {
  const t = T[lang];
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'stories'), en: routePath('en', 'stories') }} />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <div className="st-index">
          {STORIES[lang].map((s) => (
            <Link key={s.slug} href={routePath(lang, 'stories', s.slug)} className="st-card">
              <span className="ed-kicker">{s.kicker}</span>
              <b>{s.title}</b>
              <span>{s.dek}</span>
              <span className="st-card-go">{t.read} →</span>
            </Link>
          ))}
        </div>
        <SeoLinks lang={lang} current="stories" />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}

export function StoryPage({ lang, slug }: { lang: Lang; slug: string }) {
  const s = storyBySlug(lang, slug);
  if (!s) notFound();
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'stories', slug), en: routePath('en', 'stories', slug) }} />
      <main className="ed-main">
        <Link href={routePath(lang, 'stories')} className="ed-back">← {T[lang].kicker}</Link>
        <div className="ed-head">
          <span className="ed-kicker">{s.kicker}</span>
          <h1 className="ed-headline">{s.title}</h1>
          <p className="ed-lead">{s.dek}</p>
        </div>
        <StoryView lang={lang} story={s} />
        <SeoLinks lang={lang} current="stories" />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
