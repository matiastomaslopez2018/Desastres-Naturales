// Generado: ruta en su idioma. La lógica vive en src/components/landing/WhatIfPage.
import { pageLang } from '@/components/landing/Landing';
import { WhatIfPage, whatIfMeta } from '@/components/landing/WhatIfPage';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  await params;
  return whatIfMeta('en');
}

export default async function Page({ params, searchParams }: Props) {
  const lang = await pageLang(params, 'en', 'whatIf');
  return <WhatIfPage lang={lang} sp={await searchParams} />;
}
