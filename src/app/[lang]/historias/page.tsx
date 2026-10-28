// Generado: ruta en su idioma. La lógica vive en src/components/landing/StoriesPage.
import { pageLang } from '@/components/landing/Landing';
import { StoriesIndex, storiesMeta } from '@/components/landing/StoriesPage';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  await params;
  return storiesMeta('es');
}

export default async function Page({ params }: Props) {
  const lang = await pageLang(params, 'es', 'stories');
  return <StoriesIndex lang={lang} />;
}
