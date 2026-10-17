import Link from 'next/link';
import { ARTICLES } from '@/lib/learn';
import { routePath } from '@/lib/seo';
import type { DisasterEvent, Lang } from '@/lib/types';

/* Enlaces a los artículos de Aprender que corresponden al tipo de evento de una ficha. */

const BY_TYPE: Record<DisasterEvent['type'], string[]> = {
  eq: ['magnitude-intensity', 'fault-types', 'aftershocks', 'what-to-do'],
  volcano: ['volcano-types', 'vei', 'volcano-safety'],
  storm: ['forecast-cone', 'saffir-simpson', 'cyclone-names', 'hurricane-safety'],
  fire: ['fire-triangle-fwi', 'satellite-fires', 'wildfire-safety'],
  flood: ['flood-types', 'flood-safety'],
  drought: ['drought-measure', 'drought-types'],
};

export const learnHref = (lang: Lang, id: string) => {
  const a = ARTICLES.find((x) => x.id === id);
  return a ? routePath(lang, 'learn', a[lang].slug) : null;
};

export function LearnLinks({ lang, e }: { lang: Lang; e: DisasterEvent }) {
  const ids = [...BY_TYPE[e.type], ...(e.type === 'eq' && e.tsunami ? ['tsunami-formation', 'tsunami-signs'] : [])];
  const items = ids.map((id) => ARTICLES.find((a) => a.id === id)).filter((a): a is (typeof ARTICLES)[number] => !!a);
  if (!items.length) return null;
  return (
    <aside className="learn-links" aria-label={lang === 'es' ? 'Aprender' : 'Learn'}>
      <span className="geo-h">{lang === 'es' ? 'Aprender' : 'Learn'}</span>
      <ul>{items.map((a) => <li key={a.id}><Link href={routePath(lang, 'learn', a[lang].slug)}>{a[lang].title} →</Link></li>)}</ul>
    </aside>
  );
}
