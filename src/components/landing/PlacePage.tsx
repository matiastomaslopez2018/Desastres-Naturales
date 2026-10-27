// Página "Mi lugar" (la lógica interactiva vive en components/place/PlaceProfile).
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { PlaceProfile } from '@/components/place/PlaceProfile';
import { PLACE_TEXT } from '@/lib/place/text';
import { jsonLd, routePath } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import type { Lang } from '@/lib/types';

export const placeMeta = (lang: Lang) => seoMeta(lang, 'myPlace', PLACE_TEXT[lang].seoTitle, PLACE_TEXT[lang].desc);

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Lugar de la URL: ?lugar=Nombre&lat=..&lon=.. (o ?place= en inglés). */
export function placeInitial(sp: Search) {
  const lat = Number(one(sp.lat)), lon = Number(one(sp.lon)), name = (one(sp.lugar) ?? one(sp.place) ?? '').slice(0, 120);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && name ? { name, lat, lon } : null;
}

export function PlacePage({ lang, initial }: { lang: Lang; initial: { name: string; lat: number; lon: number } | null }) {
  const t = PLACE_TEXT[lang];
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: t.h1, description: t.desc, inLanguage: lang,
    url: SITE_URL + routePath(lang, 'myPlace'), applicationCategory: 'EducationalApplication', operatingSystem: 'Web',
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  };
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'myPlace'), en: routePath('en', 'myPlace') }} current="place" />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <PlaceProfile lang={lang} initial={initial} />
        <SeoLinks lang={lang} current="myPlace" />
      </main>
      <SiteFooter lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
    </div>
  );
}
