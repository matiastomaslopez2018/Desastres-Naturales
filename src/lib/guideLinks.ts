// Enlaces a la guía completa (artículo de Aprender) de cada peligro de "Qué hacer".
import { GUIDE_ARTICLE, HAZARDS, type HazardKey } from './guides';
import { ARTICLES } from './learn';
import { routePath } from './seo';
import type { Lang } from './types';

export function guideLinks(lang: Lang): Partial<Record<HazardKey, { href: string; title: string }>> {
  const out: Partial<Record<HazardKey, { href: string; title: string }>> = {};
  for (const h of HAZARDS) {
    const a = ARTICLES.find((x) => x.id === GUIDE_ARTICLE[h]);
    if (a) out[h] = { href: routePath(lang, 'learn', a[lang].slug), title: a[lang].title };
  }
  return out;
}
