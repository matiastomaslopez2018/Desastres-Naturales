// Página del simulador de volcanes (la lógica interactiva vive en components/volcano/VolcanoSim).
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { VolcanoSim, type ExtraPlace } from '@/components/volcano/VolcanoSim';
import { VOLC_TEXT } from '@/lib/volcano/text';
import { jsonLd, routePath } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import type { Lang } from '@/lib/types';

export const volcanoSimMeta = (lang: Lang) => seoMeta(lang, 'volcanoSim', VOLC_TEXT[lang].seoTitle, VOLC_TEXT[lang].desc);

/** ?lugar=Nombre|lat|lon (o ?place=) → lugar extra para la tabla de la ceniza. */
export function extraPlace(v: string | string[] | undefined): ExtraPlace | null {
  const [name, la, lo] = (Array.isArray(v) ? v[0] : v ?? '').split('|'), lat = Number(la), lon = Number(lo);
  return name && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { name: name.slice(0, 80), lat, lon } : null;
}

export function VolcanoSimPage({ lang, initial, extra }: { lang: Lang; initial?: string; extra?: ExtraPlace | null }) {
  const t = VOLC_TEXT[lang];
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: t.h1, description: t.desc, inLanguage: lang,
    url: SITE_URL + routePath(lang, 'volcanoSim'), applicationCategory: 'EducationalApplication', operatingSystem: 'Web',
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  };
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'volcanoSim'), en: routePath('en', 'volcanoSim') }} current="sim" />
      <main className="ed-main qs-page">
        <div className="ed-head">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <VolcanoSim lang={lang} initial={initial} extra={extra} />
        <SeoLinks lang={lang} current="volcanoSim" />
      </main>
      <SiteFooter lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
    </div>
  );
}
