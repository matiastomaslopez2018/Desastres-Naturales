import { notFound } from 'next/navigation';
import { Atlas } from '@/components/Atlas';
import { isLang } from '@/lib/i18n';
import { parseRange, parseYear } from '@/lib/range';

// El período llega por la URL (?range=…&year=…), así que la página se renderiza por pedido.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ range?: string; year?: string; e?: string }>;
};

export default async function Home({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  return <Atlas lang={lang} initialRange={parseRange(sp.range)} initialYear={parseYear(sp.year)} initialSel={sp.e} />;
}
