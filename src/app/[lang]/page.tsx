import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Atlas } from '@/components/Atlas';
import { SiteFooter } from '@/components/SiteHeader';
import { WeeklySummary } from '@/components/WeeklySummary';
import { isLang } from '@/lib/i18n';
import { parseRange, parseYear } from '@/lib/range';
import { getEvents } from '@/lib/server/ingest';
import type { Lang } from '@/lib/types';

// El período llega por la URL (?range=…&year=…), así que la página se renderiza por pedido.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ range?: string; year?: string; e?: string; tipo?: string }>;
};

/** El resumen de la semana se transmite aparte para no demorar el globo. */
async function Week({ lang }: { lang: Lang }) {
  const data = await getEvents('7d', new Date().getUTCFullYear()).catch(() => null);
  return data ? <WeeklySummary lang={lang} data={data} /> : null;
}

/** Home: globo 2a a pantalla completa; al hacer scroll, el resumen 2b de la semana. */
export default async function Home({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  return (
    <>
      <Atlas lang={lang} initialRange={parseRange(sp.range)} initialYear={parseYear(sp.year)} initialSel={sp.e} initialType={sp.tipo} />
      <div className="dusk" aria-hidden="true" />
      <Suspense fallback={null}>
        <Week lang={lang} />
      </Suspense>
      <div className="theme-paper"><SiteFooter lang={lang} /></div>
    </>
  );
}
