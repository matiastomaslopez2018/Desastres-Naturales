import Link from 'next/link';
import { T } from '@/lib/i18n';
import { fmtTime } from '@/lib/format';
import type { Lang } from '@/lib/types';

export type Section = 'map' | 'ranking' | 'countries' | 'method';

type Props = {
  lang: Lang;
  /** Ruta de esta misma página en cada idioma. */
  langHrefs: Record<Lang, string>;
  current?: Section;
  updatedAt?: number;
};

/** Encabezado editorial 2b: marca en serif, secciones con subrayado rojo, idioma. */
export function SiteHeader({ lang, langHrefs, current, updatedAt }: Props) {
  const t = T[lang];
  const items: { k: Section; href: string; label: string }[] = [
    { k: 'map', href: `/${lang}`, label: t.nav2.map },
    { k: 'ranking', href: `/${lang}/ranking`, label: t.nav2.ranking },
    { k: 'countries', href: `/${lang}/paises`, label: t.nav2.countries },
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
      <div className="ed-header-end">
        {updatedAt ? <span className="ed-updated">{t.updated} {fmtTime(lang, updatedAt)}</span> : null}
        <span className="ed-lang">
          {(['es', 'en'] as const).map((l, i) => (
            <span key={l}>
              {i > 0 && ' · '}
              <Link href={langHrefs[l]} hrefLang={l} aria-current={l === lang ? 'true' : undefined}>{l.toUpperCase()}</Link>
            </span>
          ))}
        </span>
      </div>
    </header>
  );
}

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = T[lang];
  return (
    <footer className="ed-footer">
      <span className="ed-footer-brand">{t.brand}</span>
      <span>{t.footerAbout}</span>
      <span>{t.carto}</span>
      <Link href={`/${lang}/metodologia`}>{t.readMethod}</Link>
    </footer>
  );
}
