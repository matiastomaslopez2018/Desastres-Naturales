// Generado: ruta en su idioma. La lógica vive en src/components/landing/TsunamiPage.
import { pageLang } from '@/components/landing/Landing';
import { TsunamiPage, tsunamiSimMeta } from '@/components/landing/TsunamiPage';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  await params;
  return tsunamiSimMeta('en');
}

export default async function Page({ params, searchParams }: Props) {
  const lang = await pageLang(params, 'en', 'tsunamiSim');
  const sp = await searchParams;
  const ev = Array.isArray(sp.tsunami) ? sp.tsunami[0] : sp.tsunami;
  return <TsunamiPage lang={lang} initial={ev} />;
}
