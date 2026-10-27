// «¿Y si pasara acá?»: un sismo real con el epicentro bajo tu ciudad.
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { WhatIf } from '@/components/WhatIf';
import { customFromQuery } from '@/lib/quake/whatif';
import { routePath } from '@/lib/seo';
import type { Lang } from '@/lib/types';

const T = {
  es: {
    kicker: '¿Y si pasara acá?', h1: 'Un gran terremoto, debajo de tu ciudad',
    seoTitle: '¿Y si pasara acá? Un terremoto histórico debajo de tu ciudad',
    desc: 'Elegí un terremoto real (Valdivia 1960, Maule 2010, Tohoku 2011, México 1985, Turquía 2023…) y mirá hasta dónde se sentiría y con qué intensidad si ocurriera debajo de tu ciudad.',
    lead: 'Elegí un sismo real y un lugar: el mapa muestra con qué intensidad se sentiría alrededor si el epicentro estuviera justo debajo. Sirve para dimensionar el tamaño de los grandes terremotos.',
  },
  en: {
    kicker: 'What if it happened here?', h1: 'A great earthquake, beneath your city',
    seoTitle: 'What if it happened here? A historic earthquake beneath your city',
    desc: 'Pick a real earthquake (Valdivia 1960, Maule 2010, Tohoku 2011, Mexico 1985, Türkiye 2023…) and see how far and how strongly it would be felt if it happened beneath your city.',
    lead: 'Pick a real earthquake and a place: the map shows how strongly it would be felt around if the epicentre were right beneath it. It helps grasp the size of great earthquakes.',
  },
};

export const whatIfMeta = (lang: Lang) => seoMeta(lang, 'whatIf', T[lang].seoTitle, T[lang].desc);

export function WhatIfPage({ lang, sp }: { lang: Lang; sp: Record<string, string | string[] | undefined> }) {
  const t = T[lang];
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'whatIf'), en: routePath('en', 'whatIf') }} />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <WhatIf lang={lang} custom={customFromQuery(sp)} />
        <SeoLinks lang={lang} current="whatIf" />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
