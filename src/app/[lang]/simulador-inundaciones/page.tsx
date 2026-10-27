// Generado: ruta en su idioma. La lógica vive en src/components/landing/FloodPage.
import { pageLang } from '@/components/landing/Landing';
import { FloodPage, floodMeta } from '@/components/landing/FloodPage';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  await params;
  return floodMeta('es');
}

export default async function Page({ params }: Props) {
  const lang = await pageLang(params, 'es', 'floodSim');
  return <FloodPage lang={lang} />;
}
