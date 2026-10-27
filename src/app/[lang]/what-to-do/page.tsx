// Generado: ruta en su idioma. La lógica vive en src/components/landing/WhatToDoPage.
import { pageLang } from '@/components/landing/Landing';
import { WhatToDoPage, whatToDoMeta } from '@/components/landing/WhatToDoPage';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  await params;
  return whatToDoMeta('en');
}

export default async function Page({ params }: Props) {
  const lang = await pageLang(params, 'en', 'whatToDo');
  return <WhatToDoPage lang={lang} />;
}
