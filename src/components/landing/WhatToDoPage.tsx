// Página "Qué hacer": las guías de cada peligro, los teléfonos de emergencia, la mochila y el plan familiar.
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { CountryPhones, FamilyPlan, Kit } from '@/components/guides/Prep';
import { GUIDES, GUIDE_SOURCES, GUIDE_T, HAZARDS } from '@/lib/guides';
import { guideLinks } from '@/lib/guideLinks';
import { jsonLd, routePath } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import type { Lang } from '@/lib/types';

const T = {
  es: {
    kicker: 'Prepararse', h1: 'Qué hacer ante un desastre natural',
    seoTitle: 'Qué hacer ante un sismo, tsunami, erupción, huracán, inundación o incendio: guía rápida',
    desc: 'Qué hacer antes, durante y después de cada desastre natural según las guías oficiales, con los teléfonos de emergencia de tu país, la mochila de emergencia y un plan familiar para imprimir.',
    lead: 'Lo esencial de cada peligro en tres momentos, según las guías oficiales de protección civil. Abajo están los teléfonos de emergencia de tu país, la mochila para armar y un plan familiar para completar e imprimir.',
    jump: 'Ir a', moments: { before: 'Antes', during: 'Durante', after: 'Después' }, full: 'Guía completa', sources: 'Fuentes',
  },
  en: {
    kicker: 'Be prepared', h1: 'What to do in a natural disaster',
    seoTitle: 'What to do in an earthquake, tsunami, eruption, hurricane, flood or wildfire: quick guide',
    desc: 'What to do before, during and after each natural disaster according to official guidance, with your country’s emergency numbers, an emergency kit and a printable family plan.',
    lead: 'The essentials of each hazard in three moments, according to official civil protection guidance. Below are your country’s emergency numbers, the kit to put together and a family plan to fill in and print.',
    jump: 'Go to', moments: { before: 'Before', during: 'During', after: 'After' }, full: 'Full guide', sources: 'Sources',
  },
};

export const whatToDoMeta = (lang: Lang) => seoMeta(lang, 'whatToDo', T[lang].seoTitle, T[lang].desc);

export function WhatToDoPage({ lang }: { lang: Lang }) {
  const t = T[lang], g = GUIDES[lang], links = guideLinks(lang), anchors = GUIDE_T[lang].anchors;
  const ld = {
    '@context': 'https://schema.org', '@type': 'HowTo', name: t.h1, description: t.desc, inLanguage: lang, url: SITE_URL + routePath(lang, 'whatToDo'),
    step: HAZARDS.map((h) => ({ '@type': 'HowToSection', name: g[h].title, itemListElement: g[h].during.map((x) => ({ '@type': 'HowToStep', text: x })) })),
  };
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'whatToDo'), en: routePath('en', 'whatToDo') }} current="learn" />
      <main className="ed-main">
        <div className="ed-head no-print">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <nav className="ml-examples no-print" aria-label={t.jump}>
          <span className="qs-help">{t.jump}:</span>
          {HAZARDS.map((h) => <a key={h} className="qs-chip" href={`#${anchors[h]}`}>{g[h].title}</a>)}
        </nav>
        <div className="no-print"><CountryPhones lang={lang} /></div>
        {HAZARDS.map((h) => (
          <section key={h} id={anchors[h]} className="wtd no-print" aria-labelledby={`wtd-${h}`}>
            <h2 id={`wtd-${h}`} className="ed-h3">{g[h].title}</h2>
            <div className="wtd-cols">
              {(['before', 'during', 'after'] as const).map((m) => (
                <div key={m} className={`wtd-col wtd-${m}`}>
                  <h3 className="wtd-h">{t.moments[m]}</h3>
                  <ul>{g[h][m].map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              ))}
            </div>
            {links[h] && <Link className="ed-more" href={links[h]!.href}>{t.full}: {links[h]!.title} →</Link>}
          </section>
        ))}
        <Kit lang={lang} />
        <FamilyPlan lang={lang} />
        <section className="no-print">
          <h2 className="ed-h3">{t.sources}</h2>
          <ul className="ed-list">{GUIDE_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a></li>)}</ul>
        </section>
        <div className="no-print"><SeoLinks lang={lang} current="whatToDo" /></div>
      </main>
      <div className="no-print"><SiteFooter lang={lang} /></div>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
    </div>
  );
}
