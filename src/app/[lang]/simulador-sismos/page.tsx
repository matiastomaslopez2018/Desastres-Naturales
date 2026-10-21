// Generado: ruta en su idioma. La lógica vive en src/components/landing/Simulator.
import { pageLang } from '@/components/landing/Landing';
import { SimulatorPage, simInitial, simulatorMeta } from '@/components/landing/Simulator';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  await params;
  return simulatorMeta('es');
}

export default async function Page({ params, searchParams }: Props) {
  const lang = await pageLang(params, 'es', 'simulator');
  return <SimulatorPage lang={lang} initial={simInitial(await searchParams)} />;
}
