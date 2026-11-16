// Generado: ruta en su idioma. La lógica vive en src/components/landing.
import { pageLang, VolcanoPage, volcanoMeta } from '@/components/landing/Landing';
import { notFound } from 'next/navigation';

// Se genera una vez y queda guardada; se regenera en segundo plano cada hora (ISR), sin ejecutar el servidor en cada visita.
export const dynamic = 'force-static';
export const revalidate = 3600;
export const maxDuration = 60;

type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return await volcanoMeta('es', slug);
}

export default async function Page({ params }: Props) {
  const p = await params;
  // Pedida con el otro idioma (/en/volcanes/…): se redirige a su par.
  const sub = p.lang === 'es' ? undefined : { es: p.slug, en: p.slug };
  if (p.lang !== 'es' && !sub) notFound();
  const lang = await pageLang(Promise.resolve(p), 'es', 'volcano', sub);
  return <VolcanoPage lang={lang} slug={p.slug} />;
}
