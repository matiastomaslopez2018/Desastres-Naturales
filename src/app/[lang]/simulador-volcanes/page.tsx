// Generado: ruta en su idioma. La lógica vive en src/components/landing/VolcanoSimPage.
import { pageLang } from '@/components/landing/Landing';
import { VolcanoSimPage, extraPlace, volcanoSimMeta } from '@/components/landing/VolcanoSimPage';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  await params;
  return volcanoSimMeta('es');
}

export default async function Page({ params, searchParams }: Props) {
  const lang = await pageLang(params, 'es', 'volcanoSim');
  const sp = await searchParams;
  const ev = sp.erupcion ?? sp.eruption;
  return <VolcanoSimPage lang={lang} initial={Array.isArray(ev) ? ev[0] : ev} extra={extraPlace(sp.lugar ?? sp.place)} />;
}
