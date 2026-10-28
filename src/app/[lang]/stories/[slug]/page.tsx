// Generado: ruta en su idioma. La lógica vive en src/components/landing/StoriesPage.
import { pageLang } from '@/components/landing/Landing';
import { StoryPage, storyMeta } from '@/components/landing/StoriesPage';
import { STORIES } from '@/lib/stories';

type Props = { params: Promise<{ lang: string; slug: string }> };

export const generateStaticParams = () => STORIES.en.map((s) => ({ lang: 'en', slug: s.slug }));

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return storyMeta('en', slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const lang = await pageLang(params, 'en', 'stories', { es: slug, en: slug });
  return <StoryPage lang={lang} slug={slug} />;
}
