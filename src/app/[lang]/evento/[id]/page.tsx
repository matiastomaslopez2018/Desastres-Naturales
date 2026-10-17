import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { QuakeGeology } from '@/components/geology/QuakeGeology';
import { TsunamiContext, wantsTsunami } from '@/components/geology/TsunamiContext';
import { StormContext } from '@/components/geology/StormContext';
import { FireContext } from '@/components/geology/FireContext';
import { notFound } from 'next/navigation';
import { EventCard } from '@/components/EventCard';
import { getTsunamiMessages } from '@/lib/server/tsunami';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { ShareButtons } from '@/components/ShareButtons';
import { StaticGlobe } from '@/components/StaticGlobe';
import { T, isLang } from '@/lib/i18n';
import { eventDescription, eventTitle, seoEventTitle } from '@/lib/eventText';
import { jsonLd, routePath } from '@/lib/seo';
import { nearestVolcano } from '@/lib/server/landing';
import { SITE_URL } from '@/lib/site';
import { countryName } from '@/lib/countries';
import { getPlates } from '@/lib/server/ingest';
import { loadEvent } from './data';
import { localTitle } from '@/lib/localize';

export const dynamic = 'force-dynamic';
// Si el evento no está en la base, se consulta a la fuente en el momento.
export const maxDuration = 60;

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLang(lang)) return {};
  const t = T[lang];
  const found = await loadEvent(id).catch(() => null);
  if (!found) return { title: `${t.notFoundTitle} · ${t.brand}`, robots: { index: false } };
  const { event: e } = found;
  const title = `${seoEventTitle(lang, e)} | ${t.brand}`;
  const description = eventDescription(lang, e);
  const path = (l: string) => `/${l}/evento/${encodeURIComponent(e.id)}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path(lang), languages: { es: path('es'), en: path('en') } },
    openGraph: {
      title, description, type: 'article', url: path(lang), siteName: t.brand,
      locale: lang === 'es' ? 'es_AR' : 'en_US',
      publishedTime: new Date(e.start ?? e.time).toISOString(),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** schema.org Event + Place: qué pasó, cuándo y dónde, con la fuente oficial. */
function eventLd(lang: 'es' | 'en', e: Parameters<typeof seoEventTitle>[1]) {
  const url = `${SITE_URL}/${lang}/evento/${encodeURIComponent(e.id)}`;
  const where = e.iso3 ? countryName(e.iso3, lang) : e.country;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: seoEventTitle(lang, e),
    description: eventDescription(lang, e),
    startDate: new Date(e.start ?? e.time).toISOString(),
    endDate: new Date(Math.max(e.time, e.end ?? 0, e.start ?? 0)).toISOString(),
    inLanguage: lang,
    url,
    image: `${url}/opengraph-image`,
    location: {
      '@type': 'Place',
      name: localTitle(e, lang),
      geo: { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lon },
      ...(where ? { address: { '@type': 'PostalAddress', addressCountry: where } } : {}),
    },
    ...(e.url || e.apiUrl ? { sameAs: [e.url ?? e.apiUrl] } : {}),
  };
}

export default async function EventPage({ params }: Props) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const found = await loadEvent(id);
  if (!found) notFound();
  const { event: e, detail } = found;
  const t = T[lang];
  const [plates, tsu] = await Promise.all([getPlates().catch(() => undefined), getTsunamiMessages().catch(() => null)]);
  const mapHref = `/${lang}?e=${encodeURIComponent(e.id)}`;
  const volc = e.type === 'volcano' ? await nearestVolcano(e.lat, e.lon).catch(() => null) : null;

  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: `/es/evento/${encodeURIComponent(e.id)}`, en: `/en/evento/${encodeURIComponent(e.id)}` }} />

      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(eventLd(lang, e))} />
      <main className="ed-main">
        <Link href={mapHref} className="ed-back">{t.backToMap}</Link>
        <div className="ed-event">
          <figure className="ed-event-figure">
            <StaticGlobe e={e} plates={plates} label={`${t.mapAlt}: ${localTitle(e, lang)}`} />
            <figcaption className="tabular">{eventDescription(lang, e)}</figcaption>
          </figure>
          <EventCard lang={lang} e={e} detail={detail} titleAs="h1" tsunami={tsu?.messages ?? null}
            actions={
              <>
                <ShareButtons lang={lang} path={`/${lang}/evento/${encodeURIComponent(e.id)}`} text={t.shareEvent(eventTitle(lang, e))} />
                <Link href={mapHref} className="ed-button">{t.viewOnMap}</Link>
              </>
            } />
        </div>
        {/* Contexto geológico: tarda unos segundos la primera vez (después queda en la base). */}
        {volc && (
          <p className="geo-link"><Link href={routePath(lang, 'volcano', volc.slug)}>{t.volcPage}: {volc.v.title} →</Link></p>
        )}
        {e.type === 'eq' && e.src === 'USGS' && (
          <Suspense fallback={<p className="ed-note">{t.loading}</p>}>
            <QuakeGeology lang={lang} e={e} />
          </Suspense>
        )}
        {e.type === 'storm' && <StormContext lang={lang} e={e} />}
        {e.type === 'fire' && (
          <Suspense fallback={<p className="ed-note">{t.loading}</p>}>
            <FireContext lang={lang} e={e} />
          </Suspense>
        )}
        {wantsTsunami(e) && (
          <Suspense fallback={null}>
            <TsunamiContext lang={lang} e={e} />
          </Suspense>
        )}
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
