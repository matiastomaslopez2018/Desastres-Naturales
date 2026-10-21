// Página del simulador de tsunamis (la lógica interactiva vive en components/tsunami/TsunamiSim).
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { TsunamiSim } from '@/components/tsunami/TsunamiSim';
import { TSU_TEXT } from '@/lib/tsunami/text';
import { jsonLd, routePath } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import type { Lang } from '@/lib/types';

export const tsunamiSimMeta = (lang: Lang) => seoMeta(lang, 'tsunamiSim', TSU_TEXT[lang].seoTitle, TSU_TEXT[lang].desc);

export function TsunamiPage({ lang, initial }: { lang: Lang; initial?: string }) {
  const t = TSU_TEXT[lang];
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: t.h1, description: t.desc, inLanguage: lang,
    url: SITE_URL + routePath(lang, 'tsunamiSim'), applicationCategory: 'EducationalApplication', operatingSystem: 'Web',
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  };
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'tsunamiSim'), en: routePath('en', 'tsunamiSim') }} current="sim" />
      <main className="ed-main qs-page">
        <div className="ed-head">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <TsunamiSim lang={lang} initial={initial} />
        <SeoLinks lang={lang} current="tsunamiSim" />
      </main>
      <SiteFooter lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
    </div>
  );
}
