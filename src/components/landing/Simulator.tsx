// Página del simulador de sismos (la lógica interactiva vive en components/quake/QuakeSim).
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { QuakeSim, type SimInitial } from '@/components/quake/QuakeSim';
import { SIM_TEXT } from '@/lib/quake/text';
import { jsonLd, routePath } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import type { Lang } from '@/lib/types';

export const simulatorMeta = (lang: Lang) => seoMeta(lang, 'simulator', SIM_TEXT[lang].seoTitle, SIM_TEXT[lang].desc);

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (v: string | string[] | undefined) => { const n = Number(one(v)); return Number.isFinite(n) && one(v) !== undefined && one(v) !== '' ? n : undefined; };

/** Escenario inicial desde la URL: ?sismo=<preset> o ?m=&h=&d=&amb=&mec=&vs=&t=<título del sismo del mapa>. */
export function simInitial(sp: Search): SimInitial {
  const amb = one(sp.amb), mec = one(sp.mec);
  return {
    preset: one(sp.sismo),
    mag: num(sp.m), depth: num(sp.h), dist: num(sp.d), vs30: num(sp.vs),
    setting: amb === 'crustal' || amb === 'interface' || amb === 'slab' ? amb : undefined,
    mech: mec === 'strike-slip' || mec === 'normal' || mec === 'reverse' ? mec : undefined,
    title: one(sp.t)?.slice(0, 140),
  };
}

export function SimulatorPage({ lang, initial }: { lang: Lang; initial: SimInitial }) {
  const t = SIM_TEXT[lang];
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: t.h1, description: t.desc, inLanguage: lang,
    url: SITE_URL + routePath(lang, 'simulator'), applicationCategory: 'EducationalApplication', operatingSystem: 'Web',
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  };
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'simulator'), en: routePath('en', 'simulator') }} current="sim" />
      <main className="ed-main qs-page">
        <div className="ed-head">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <QuakeSim lang={lang} initial={initial} />
        <SeoLinks lang={lang} current="simulator" />
      </main>
      <SiteFooter lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
    </div>
  );
}
