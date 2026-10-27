// Generado: ruta en su idioma. La lógica vive en src/components/landing/PlacePage.
import { pageLang } from '@/components/landing/Landing';
import { PlacePage, placeInitial, placeMeta } from '@/components/landing/PlacePage';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  await params;
  return placeMeta('en');
}

export default async function Page({ params, searchParams }: Props) {
  const lang = await pageLang(params, 'en', 'myPlace');
  return <PlacePage lang={lang} initial={placeInitial(await searchParams)} />;
}
