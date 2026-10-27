/*
 * Textos de un aviso en vivo (título, lugar, dato extra y enlace), iguales en la tarjeta de la página y en la
 * notificación push que llega con la página cerrada.
 */
import type { LiveAlert } from './alerts';
import { fmtNum } from './format';
import { localPlace } from './localize';
import { routePath } from './seo';
import type { Lang } from './types';

const T = {
  es: {
    eq: (m: string) => `Sismo de magnitud ${m}`, tsunami: 'Mensaje de tsunami', storm: (w: string) => w,
    ash: (v: string) => `Ceniza del volcán ${v}`, ashTop: (km: string) => `Nube hasta ${km} km de altura`,
    word: { hurricane: 'Huracán', typhoon: 'Tifón', cyclone: 'Ciclón', storm: 'Tormenta tropical' },
    levels: { warning: 'Alerta de tsunami', advisory: 'Aviso de tsunami', watch: 'Vigilancia de tsunami' } as Record<string, string>,
    oceanic: 'En zona oceánica: revisá los avisos oficiales de tsunami.',
  },
  en: {
    eq: (m: string) => `Magnitude ${m} earthquake`, tsunami: 'Tsunami message', storm: (w: string) => w,
    ash: (v: string) => `Ash from ${v} volcano`, ashTop: (km: string) => `Cloud up to ${km} km high`,
    word: { hurricane: 'Hurricane', typhoon: 'Typhoon', cyclone: 'Cyclone', storm: 'Tropical storm' },
    levels: { warning: 'Tsunami warning', advisory: 'Tsunami advisory', watch: 'Tsunami watch' } as Record<string, string>,
    oceanic: 'Offshore: check the official tsunami messages.',
  },
};

export function alertTexts(lang: Lang, a: LiveAlert) {
  const t = T[lang];
  if (a.kind === 'eq') return { title: t.eq(fmtNum(lang, a.mag ?? 0, 1)), place: localPlace(a.title, lang), extra: a.tsunami ? t.oceanic : null, href: `/${lang}/evento/${encodeURIComponent(a.id)}` };
  if (a.kind === 'tsunami') return { title: (a.level && t.levels[a.level]) || t.tsunami, place: a.title, extra: a.mag ? `M ${fmtNum(lang, a.mag, 1)}` : null, href: routePath(lang, 'tsunami') };
  if (a.kind === 'ash') return { title: t.ash(a.title), place: [a.country?.[lang], t.ashTop(fmtNum(lang, a.topKm ?? 0, 1))].filter(Boolean).join(' · '), extra: null, href: `${routePath(lang, 'volcanoSim')}${a.sim ? `?${lang === 'es' ? 'erupcion' : 'eruption'}=${a.sim}` : ''}` };
  const strong = /^(HU|TY|STY|MH)/i.test(a.classification ?? '') || (a.windKt ?? 0) >= 64;
  const word = strong ? t.word[a.basinWord ?? 'hurricane'] : t.word.storm;
  return { title: `${word} ${a.title}`, place: a.windKt ? `${fmtNum(lang, a.windKt * 1.852)} km/h` : '', extra: null, href: routePath(lang, 'hurricanes') };
}
