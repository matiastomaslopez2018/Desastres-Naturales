// Generado: ruta en su idioma. La lógica vive en src/components/landing/WidgetPage.
import { pageLang } from '@/components/landing/Landing';
import { WidgetPage, widgetMeta } from '@/components/landing/WidgetPage';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  await params;
  return widgetMeta('es');
}

export default async function Page({ params }: Props) {
  const lang = await pageLang(params, 'es', 'widget');
  return <WidgetPage lang={lang} />;
}
