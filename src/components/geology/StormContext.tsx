import grid from '@/data/ibtracs_grid.json';
import { T } from '@/lib/i18n';
import { fmtNum } from '@/lib/format';
import { basinWord } from '@/lib/server/gdacsStorms';
import type { DisasterEvent, Lang } from '@/lib/types';

/*
 * Ficha de ciclón: cómo se llama según la región, el centro oficial de la OMM, cómo leer el
 * cono y los ciclones históricos (IBTrACS, desde 1980, 64 kt o más) que pasaron por la zona.
 */

const G = grid as unknown as { storms: [string, string, number, number, string][]; cells: Record<string, number[]> };

const TXT = {
  es: {
    title: 'Contexto del ciclón', region: 'Nombre según la región',
    words: {
      hurricane: 'En el Atlántico y el Pacífico nordeste y central, un ciclón tropical con vientos de 119 km/h (64 kt) o más se llama huracán.',
      typhoon: 'En el Pacífico noroeste, un ciclón tropical con vientos de 119 km/h (64 kt) o más se llama tifón.',
      cyclone: 'En el océano Índico y el Pacífico sur se usa el nombre ciclón (ciclón tropical severo en Australia).',
    },
    cone: 'Cómo leer el cono de pronóstico', coneText: 'El cono muestra dónde puede estar el centro de la tormenta en los próximos días, con una probabilidad de alrededor de dos de cada tres según los errores de pronóstico de los últimos años. No muestra el tamaño de la tormenta: la lluvia, el viento y la marejada pueden llegar lejos, fuera del cono.',
    history: 'Ciclones históricos que pasaron por la zona', historyNote: 'Ciclones tropicales desde 1980 que llegaron a 64 kt (119 km/h) y pasaron a unos 300 km o menos, según IBTrACS (NOAA NCEI). Ordenados por viento máximo.',
    none: 'IBTrACS no registra ciclones de esa intensidad cerca de esta zona desde 1980.', unnamed: 'Sin nombre',
  },
  en: {
    title: 'Cyclone context', region: 'Name by region',
    words: {
      hurricane: 'In the Atlantic and the northeast and central Pacific, a tropical cyclone with winds of 119 km/h (64 kt) or more is called a hurricane.',
      typhoon: 'In the northwest Pacific, a tropical cyclone with winds of 119 km/h (64 kt) or more is called a typhoon.',
      cyclone: 'In the Indian Ocean and the South Pacific the name cyclone is used (severe tropical cyclone in Australia).',
    },
    cone: 'How to read the forecast cone', coneText: 'The cone shows where the center of the storm may be over the coming days, with roughly a two-in-three chance based on recent forecast errors. It does not show the size of the storm: rain, wind and storm surge can reach far outside the cone.',
    history: 'Historical cyclones that crossed the area', historyNote: 'Tropical cyclones since 1980 that reached 64 kt (119 km/h) and passed within about 300 km, according to IBTrACS (NOAA NCEI). Sorted by peak wind.',
    none: 'IBTrACS records no cyclones of that intensity near this area since 1980.', unnamed: 'Unnamed',
  },
};

export function StormContext({ lang, e }: { lang: Lang; e: DisasterEvent }) {
  const t = TXT[lang], nf = (x: number) => fmtNum(lang, x);
  const word = basinWord(e.lon, e.lat);
  const cx = Math.floor(e.lon / 2), cy = Math.floor(e.lat / 2);
  const ids = new Set<number>();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const i of G.cells[`${cx + dx},${cy + dy}`] ?? []) ids.add(i);
  const list = [...ids].map((i) => G.storms[i]).sort((a, b) => b[3] - a[3]).slice(0, 10);
  return (
    <section className="geo" aria-labelledby="storm-ctx">
      <h2 id="storm-ctx" className="ed-h3">{t.title}</h2>
      <div className="geo-block"><h3 className="geo-h">{t.region}</h3><p>{t.words[word]}</p></div>
      <div className="geo-block"><h3 className="geo-h">{t.cone}</h3><p>{t.coneText}</p></div>
      <div className="geo-block">
        <h3 className="geo-h">{t.history}</h3>
        {list.length ? (
          <ul className="geo-hist">
            {list.map(([sid, name, season, wind]) => (
              <li key={sid}>
                <a href={`https://ncics.org/ibtracs/index.php?name=v04r01-${sid}`} target="_blank" rel="noopener noreferrer">{name ? name.charAt(0) + name.slice(1).toLowerCase() : t.unnamed} ({season})</a>
                {' · '}{nf(Math.round(wind * 1.852))} km/h ({nf(wind)} kt)
              </li>
            ))}
          </ul>
        ) : <p className="ed-note">{t.none}</p>}
        <p className="ed-note">{t.historyNote} {T[lang].sources}: IBTrACS v04r01.</p>
      </div>
    </section>
  );
}
