// Generado: ruta en su idioma. La lógica vive en src/components/landing/ThisDayPage.
import { pageLang } from '@/components/landing/Landing';
import { ThisDayPage, thisDayMeta } from '@/components/landing/ThisDayPage';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  await params;
  return thisDayMeta('es');
}

export default async function Page({ params, searchParams }: Props) {
  const lang = await pageLang(params, 'es', 'thisDay');
  const d = (await searchParams).fecha;
  return <ThisDayPage lang={lang} date={typeof d === 'string' ? d : undefined} />;
}
