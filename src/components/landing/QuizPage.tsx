// «¿Qué harías?»: situaciones de emergencia con tres opciones, basadas en las guías oficiales de «Qué hacer».
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { Quiz } from '@/components/Quiz';
import { routePath } from '@/lib/seo';
import type { Lang } from '@/lib/types';

const T = {
  es: {
    kicker: '¿Qué harías?', h1: 'Pon a prueba qué hacer en una emergencia',
    seoTitle: '¿Qué harías? Test de qué hacer en un sismo, tsunami, inundación o incendio',
    desc: 'Diez situaciones reales: un sismo en el trabajo, el mar que se retira, una calle inundada, ceniza volcánica… Elegí qué harías y aprendé por qué, con las guías de Ready.gov, el NWS, IVHHN y la OMS.',
    lead: 'Diez situaciones de emergencia con tres opciones cada una. Elegí qué harías: te explicamos por qué cada opción es segura o no, según las guías oficiales. Sirve para repasar en familia o en el aula.',
  },
  en: {
    kicker: 'What would you do?', h1: 'Test what to do in an emergency',
    seoTitle: 'What would you do? Earthquake, tsunami, flood and wildfire safety quiz',
    desc: 'Ten real situations: an earthquake at work, the sea pulling back, a flooded street, volcanic ash… Choose what you would do and learn why, with guidance from Ready.gov, the NWS, IVHHN and the WHO.',
    lead: 'Ten emergency situations with three options each. Choose what you would do: we explain why each option is safe or not, according to official guidance. Good for reviewing with your family or in class.',
  },
};

export const quizMeta = (lang: Lang) => seoMeta(lang, 'quiz', T[lang].seoTitle, T[lang].desc);

export function QuizPage({ lang }: { lang: Lang }) {
  const t = T[lang];
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'quiz'), en: routePath('en', 'quiz') }} />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <Quiz lang={lang} />
        <SeoLinks lang={lang} current="quiz" />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
