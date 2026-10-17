// Generado: ruta en su idioma. La lógica vive en src/components/landing.
import { pageLang } from '@/components/landing/Landing';
import { LearnIndex, learnIndexMeta } from '@/components/landing/Learn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  await params;
  return learnIndexMeta('en');
}

export default async function Page({ params }: Props) {
  const lang = await pageLang(params, 'en', 'learn');
  return <LearnIndex lang={lang} />;
}
