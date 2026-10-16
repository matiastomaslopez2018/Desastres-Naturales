import Link from 'next/link';
import { T } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

type Props = {
  lang: Lang;
  /** Ruta de esta misma página en cada idioma. */
  langHrefs: Record<Lang, string>;
  current?: 'map' | 'ranking';
};

/** Encabezado de las páginas de servidor (ficha, ranking, país). El mapa tiene el suyo en Atlas. */
export function SiteHeader({ lang, langHrefs, current }: Props) {
  const t = T[lang];
  return (
    <header className="nav site-nav">
      <div className="nav-brand brand">
        <Link href={`/${lang}`} className="brand-name brand-link">{t.brand}</Link>
        <span className="brand-sub">{t.brandSub}</span>
      </div>
      <SiteNav lang={lang} current={current} />
      <div className="seg" role="group" aria-label="Idioma / Language">
        {(['es', 'en'] as const).map((l) => (
          <Link key={l} href={langHrefs[l]} hrefLang={l} className={`seg-opt seg-link${l === lang ? ' on' : ''}`} aria-current={l === lang ? 'true' : undefined}>
            {l.toUpperCase()}
          </Link>
        ))}
      </div>
    </header>
  );
}

export function SiteNav({ lang, current }: { lang: Lang; current?: 'map' | 'ranking' }) {
  const t = T[lang];
  const items = [
    { k: 'map' as const, href: `/${lang}`, label: t.nav.map },
    { k: 'ranking' as const, href: `/${lang}/ranking`, label: t.nav.ranking },
  ];
  return (
    <nav className="site-links" aria-label={lang === 'es' ? 'Secciones' : 'Sections'}>
      {items.map((i) => (
        <Link key={i.k} href={i.href} aria-current={current === i.k ? 'page' : undefined}>{i.label}</Link>
      ))}
    </nav>
  );
}
