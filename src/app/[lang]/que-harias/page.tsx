// Generado: ruta en su idioma. La lógica vive en src/components/landing/QuizPage.
import { pageLang } from '@/components/landing/Landing';
import { QuizPage, quizMeta } from '@/components/landing/QuizPage';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  await params;
  return quizMeta('es');
}

export default async function Page({ params }: Props) {
  const lang = await pageLang(params, 'es', 'quiz');
  return <QuizPage lang={lang} />;
}
