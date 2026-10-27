// «Un día como hoy»: desastres que ocurrieron en esta fecha en otros años.
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { ThisDay } from '@/components/ThisDay';
import { routePath } from '@/lib/seo';
import { parseDay } from '@/lib/thisDay';
import type { Lang } from '@/lib/types';

const T = {
  es: {
    kicker: 'Un día como hoy', h1: 'Qué desastres pasaron en esta fecha',
    seoTitle: 'Un día como hoy: terremotos, tsunamis, erupciones y huracanes de la historia',
    desc: 'Los grandes terremotos, tsunamis, erupciones volcánicas y ciclones que ocurrieron en un día como hoy, con datos de NOAA NCEI e IBTrACS. Elegí cualquier fecha.',
    lead: 'Los sismos, tsunamis y erupciones con víctimas o daños importantes, y los ciclones más intensos, que ocurrieron en esta misma fecha en otros años. Elegí otro día con las flechas o el calendario.',
  },
  en: {
    kicker: 'On this day', h1: 'Disasters that happened on this date',
    seoTitle: 'On this day: historic earthquakes, tsunamis, eruptions and hurricanes',
    desc: 'The major earthquakes, tsunamis, volcanic eruptions and cyclones that happened on this day in history, with data from NOAA NCEI and IBTrACS. Pick any date.',
    lead: 'Earthquakes, tsunamis and eruptions with deaths or major damage, and the most intense cyclones, that happened on this same date in other years. Pick another day with the arrows or the calendar.',
  },
};

export const thisDayMeta = (lang: Lang) => seoMeta(lang, 'thisDay', T[lang].seoTitle, T[lang].desc);

export function ThisDayPage({ lang, date }: { lang: Lang; date?: string }) {
  const t = T[lang];
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'thisDay'), en: routePath('en', 'thisDay') }} />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <ThisDay lang={lang} initial={parseDay(date)} />
        <SeoLinks lang={lang} current="thisDay" />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
