/* Tipos de volcán: una foto real de cada uno, descripción y ejemplos; al tocarlo se abre un volcán de ese tipo. */
import type { Lang } from '@/lib/types';
import type { VolcanoType } from '@/lib/volcano/presets';
import { VOLC_TEXT } from '@/lib/volcano/text';

const ORDER: VolcanoType[] = ['shield', 'strato', 'cone', 'dome', 'caldera'];

/** Foto de un volcán de cada tipo (Wikimedia Commons; dominio público del USGS o licencia libre), con su crédito. */
const PHOTO: Record<VolcanoType, { place: Record<Lang, string>; credit: string; license: string; page: string }> = {
  shield: { place: { es: 'Mauna Kea y Mauna Loa, Hawái', en: 'Mauna Kea and Mauna Loa, Hawaii' }, credit: 'Mds08011', license: 'CC BY 4.0', page: 'https://commons.wikimedia.org/wiki/File:Mauna_Kea_and_Mauna_Loa_from_Air.jpg' },
  strato: { place: { es: 'Volcán Osorno, Chile', en: 'Osorno volcano, Chile' }, credit: 'W. Bulach', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:00_126_2685_Vulcano_Osorno_Chile.jpg' },
  cone: { place: { es: 'Parícutin en erupción, México (años 40)', en: 'Parícutin erupting, Mexico (1940s)' }, credit: 'R. E. Wilcox, USGS', license: 'dominio público', page: 'https://commons.wikimedia.org/wiki/File:Paricutin_30_613.jpg' },
  dome: { place: { es: 'Domo de lava del monte St. Helens, EE. UU.', en: 'Mount St. Helens lava dome, USA' }, credit: 'Rick Hoblitt, USGS', license: 'dominio público', page: 'https://commons.wikimedia.org/wiki/File:East_Dome_Mount_St._Helens.jpg' },
  caldera: { place: { es: 'Crater Lake, una caldera en Oregón, EE. UU.', en: 'Crater Lake, a caldera in Oregon, USA' }, credit: 'Mike Doukas, USGS', license: 'dominio público', page: 'https://commons.wikimedia.org/wiki/File:Aerial_Crater_Lake_(cropped).jpg' },
};

export function TypeCards({ lang, current, onPick }: { lang: Lang; current: VolcanoType | null; onPick: (t: VolcanoType) => void }) {
  const t = VOLC_TEXT[lang];
  return (
    <section className="vs-types" aria-label={t.types}>
      <h2 className="qs-h">{t.types}</h2>
      <p className="qs-help">{t.typesHelp}</p>
      <div className="vs-type-grid">
        {ORDER.map((k) => (
          <div key={k} className="vs-type" data-on={current === k || undefined}>
            <button type="button" className="vs-type-btn" aria-pressed={current === k} onClick={() => onPick(k)}>
              <span className="vs-type-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/images/volcano-types/${k}.jpg`} alt={PHOTO[k].place[lang]} width={720} height={405} loading="lazy" />
                <span className="vs-type-place">{PHOTO[k].place[lang]}</span>
              </span>
              <span className="vs-type-name">{t.typeNames[k]}</span>
              <span className="vs-type-text">{t.typeText[k]}</span>
              <span className="vs-type-ex">{t.typeExamples[k]}</span>
            </button>
            <a className="vs-type-credit" href={PHOTO[k].page} target="_blank" rel="noopener noreferrer">{t.photo}: {PHOTO[k].credit} ({lang === 'en' && PHOTO[k].license === 'dominio público' ? 'public domain' : PHOTO[k].license})</a>
          </div>
        ))}
      </div>
    </section>
  );
}
