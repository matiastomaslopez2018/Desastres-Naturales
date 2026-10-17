// Generado: ruta en su idioma. La lógica vive en src/components/landing.
import { pageLang, Hurricanes, hurricanesMeta } from '@/components/landing/Landing';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  await params;
  return hurricanesMeta('en');
}

export default async function Page({ params }: Props) {
  const lang = await pageLang(params, 'en', 'hurricanes');
  return <Hurricanes lang={lang} />;
}
