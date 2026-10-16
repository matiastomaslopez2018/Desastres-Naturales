import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EventCard } from '@/components/EventCard';
import { SiteHeader } from '@/components/SiteHeader';
import { StaticGlobe } from '@/components/StaticGlobe';
import { T, isLang } from '@/lib/i18n';
import { eventDescription, eventTitle } from '@/lib/eventText';
import { getPlates } from '@/lib/server/ingest';
import { loadEvent } from './data';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLang(lang)) return {};
  const t = T[lang];
  const found = await loadEvent(id).catch(() => null);
  if (!found) return { title: `${t.notFoundTitle} · ${t.brand}`, robots: { index: false } };
  const { event: e } = found;
  const title = `${eventTitle(lang, e)} · ${t.brand}`;
  const description = eventDescription(lang, e);
  const path = (l: string) => `/${l}/evento/${encodeURIComponent(e.id)}`;
  return {
    title,
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

export default async function EventPage({ params }: Props) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const found = await loadEvent(id);
  if (!found) notFound();
  const { event: e, detail } = found;
  const t = T[lang];
  const plates = await getPlates().catch(() => undefined);
  const mapHref = `/${lang}?e=${encodeURIComponent(e.id)}`;

  return (
    <div className="page">
      <SiteHeader lang={lang} langHrefs={{ es: `/es/evento/${encodeURIComponent(e.id)}`, en: `/en/evento/${encodeURIComponent(e.id)}` }} />

      <main className="event-page">
        <div className="event-page-globe">
          <Link href={mapHref} className="muted-12 back-link">{t.backToMap}</Link>
          <StaticGlobe e={e} plates={plates} label={`${t.mapAlt}: ${e.title}`} />
          <p className="muted-12 tabular" style={{ margin: 0 }}>{eventDescription(lang, e)}</p>
        </div>
        <div className="event-page-card">
          <EventCard lang={lang} e={e} detail={detail} titleAs="h1"
            actions={<Link href={mapHref} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>{t.viewOnMap}</Link>} />
        </div>
      </main>

      <footer className="site-footer">
        <span>{t.carto}</span>
      </footer>
    </div>
  );
}
