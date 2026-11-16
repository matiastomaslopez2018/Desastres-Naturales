// Generado: ruta en su idioma. La lógica vive en src/components/landing.
import { pageLang, QuakesIn, quakesInMeta, quakeSlugs } from '@/components/landing/Landing';
import { notFound } from 'next/navigation';

// Se genera una vez y queda guardada; se regenera en segundo plano cada 5 minutos (ISR), sin ejecutar el servidor en cada visita.
export const dynamic = 'force-static';
export const revalidate = 300;
export const maxDuration = 60;

type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return quakesInMeta('en', slug);
}

export default async function Page({ params }: Props) {
  const p = await params;
  // Pedida con el otro idioma (/es/earthquakes/…): se redirige a su par.
  const sub = p.lang === 'en' ? undefined : quakeSlugs('en', p.slug);
  if (p.lang !== 'en' && !sub) notFound();
  const lang = await pageLang(Promise.resolve(p), 'en', 'quakesIn', sub);
  return <QuakesIn lang={lang} slug={p.slug} />;
}
