// Simulador de inundaciones ("modelo de bañera" sobre el relieve).
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { FloodSim } from '@/components/flood/FloodSim';
import { routePath } from '@/lib/seo';
import type { Lang } from '@/lib/types';

const T = {
  es: {
    kicker: 'Simulador de inundaciones', h1: '¿Hasta dónde llegaría el agua?',
    seoTitle: 'Simulador de inundaciones: hasta dónde llegaría el agua en tu ciudad',
    desc: 'Elegí un río, una laguna o la costa y subí el nivel del agua: el simulador muestra qué zonas quedarían bajo el agua según el relieve, sobre la imagen satelital.',
    lead: 'Buscá un lugar, tocá el río, la laguna o el mar y subí el nivel con el deslizador: se pintan las zonas que quedarían bajo el agua según el relieve, con su profundidad.',
  },
  en: {
    kicker: 'Flood simulator', h1: 'How far would the water reach?',
    seoTitle: 'Flood simulator: how far the water would reach in your city',
    desc: 'Pick a river, lake or coast and raise the water level: the simulator shows which areas would be under water according to the terrain, over satellite imagery.',
    lead: 'Search for a place, tap the river, lake or sea and raise the level with the slider: the areas that would be under water according to the terrain are painted, with their depth.',
  },
};

export const floodMeta = (lang: Lang) => seoMeta(lang, 'floodSim', T[lang].seoTitle, T[lang].desc);

export function FloodPage({ lang }: { lang: Lang }) {
  const t = T[lang];
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'floodSim'), en: routePath('en', 'floodSim') }} />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <FloodSim lang={lang} />
        <SeoLinks lang={lang} current="floodSim" />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
