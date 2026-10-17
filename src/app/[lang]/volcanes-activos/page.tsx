// Generado: ruta en su idioma. La lógica vive en src/components/landing.
import { pageLang, VolcanoesNow, volcanoesNowMeta } from '@/components/landing/Landing';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  await params;
  return volcanoesNowMeta('es');
}

export default async function Page({ params }: Props) {
  const lang = await pageLang(params, 'es', 'volcanoesNow');
  return <VolcanoesNow lang={lang} />;
}
