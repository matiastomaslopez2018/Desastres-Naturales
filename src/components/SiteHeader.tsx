import Link from 'next/link';
import { T } from '@/lib/i18n';
import { fmtTime } from '@/lib/format';
import { cached } from '@/lib/server/cache';
import { lastRuns } from '@/lib/server/db';
import { routePath, type RouteKey } from '@/lib/seo';
import { SEO } from '@/lib/seoText';
import type { Lang } from '@/lib/types';

export type Section = 'map' | 'ranking' | 'countries' | 'learn' | 'method';

type Props = {
  lang: Lang;
  /** Ruta de esta misma página en cada idioma. */
  langHrefs: Record<Lang, string>;
  current?: Section;
  updatedAt?: number;
};

/** Encabezado editorial 2b: marca en serif, secciones con subrayado rojo, idioma. */
/** Último dato que trajo la ingesta (para "Actualizado…" en las páginas que no pasan su propia hora). */
const lastIngest = () => cached('header:lastIngest', 6e4, async () => {
  const runs = await lastRuns().catch(() => ({}));
  return Math.max(0, ...Object.values(runs).map((r) => r?.lastOkAt ?? 0));
});

export async function SiteHeader({ lang, langHrefs, current, updatedAt }: Props) {
  const t = T[lang];
  const when = updatedAt || (await lastIngest()) || null;
  const items: { k: Section; href: string; label: string }[] = [
    { k: 'map', href: `/${lang}`, label: t.nav2.map },
    { k: 'ranking', href: `/${lang}/ranking`, label: t.nav2.ranking },
    { k: 'countries', href: `/${lang}/paises`, label: t.nav2.countries },
    { k: 'learn', href: routePath(lang, 'learn'), label: t.nav2.learn },
    { k: 'method', href: `/${lang}/metodologia`, label: t.nav2.method },
  ];
  return (
    <header className="ed-header">
      <Link href={`/${lang}`} className="ed-brand">{t.brand}</Link>
      <nav className="ed-nav" aria-label={lang === 'es' ? 'Secciones' : 'Sections'}>
        {items.map((i) => (
          <Link key={i.k} href={i.href} aria-current={current === i.k ? 'page' : undefined}>{i.label}</Link>
        ))}
      </nav>
      {when ? <span className="ed-updated">{t.updated} {fmtTime(lang, when, 'UTC')}</span> : null}
      <span className="ed-lang">
          {(['es', 'en'] as const).map((l, i) => (
            <span key={l}>
              {i > 0 && ' · '}
              <Link href={langHrefs[l]} hrefLang={l} aria-current={l === lang ? 'true' : undefined}>{l.toUpperCase()}</Link>
            </span>
          ))}
      </span>
    </header>
  );
}

const FOOTER_LINKS: [RouteKey, (l: Lang) => string][] = [
  ['quakesToday', (l) => SEO[l].quakesToday.h1], ['volcanoesNow', (l) => SEO[l].volcanoesNow.h1], ['fires', (l) => SEO[l].fires.h1],
  ['hurricanes', (l) => SEO[l].hurricanes.h1], ['tsunami', (l) => SEO[l].tsunami.h1], ['learn', (l) => T[l].learn.title],
];

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = T[lang];
  return (
    <footer className="ed-footer">
      <span className="ed-footer-brand">{t.brand}</span>
      <span>{t.footerAbout}</span>
      <span>{t.carto}</span>
      <Link href={`/${lang}/metodologia`}>{t.readMethod}</Link>
      <nav className="ed-footer-links" aria-label={t.learn.related}>
        {FOOTER_LINKS.map(([k, label]) => <Link key={k} href={routePath(lang, k)}>{label(lang)}</Link>)}
      </nav>
    </footer>
  );
}
