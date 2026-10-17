// Generado: ruta en su idioma. La lógica vive en src/components/landing.
import { pageLang } from '@/components/landing/Landing';
import { LearnArticle, learnMeta, learnSlugs } from '@/components/landing/Learn';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return learnMeta('es', slug);
}

export default async function Page({ params }: Props) {
  const p = await params;
  // Pedida con el otro idioma (/en/aprender/…): se redirige a su par.
  const sub = p.lang === 'es' ? undefined : learnSlugs('es', p.slug);
  if (p.lang !== 'es' && !sub) notFound();
  const lang = await pageLang(Promise.resolve(p), 'es', 'learn', sub);
  return <LearnArticle lang={lang} slug={p.slug} />;
}
