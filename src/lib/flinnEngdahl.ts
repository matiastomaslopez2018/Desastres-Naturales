/*
 * Regiones sísmicas Flinn-Engdahl (el estándar que usa USGS para nombrar lugares
 * lejos de una ciudad: "south of the Fiji Islands", "central Mid-Atlantic Ridge").
 * Diccionario ES de las ~120 más frecuentes en nuestra base + reglas de prefijos.
 * Lo que no está en el diccionario queda en inglés, entero, para no mezclar idiomas.
 *
 * Cada entrada: [nombre en castellano, artículo] — el artículo permite escribir
 * "al sur de las Islas Fiyi" o "al norte del Mar de Banda".
 */

type Art = '' | 'el' | 'la' | 'los' | 'las';
type Entry = readonly [string, Art];

const D: Record<string, Entry> = {
  // Dorsales, fosas y puntos triples
  'Mid-Atlantic Ridge': ['Dorsal Mesoatlántica', 'la'],
  'Mid-Indian Ridge': ['Dorsal Índica Central', 'la'],
  'East Pacific Rise': ['Dorsal del Pacífico Oriental', 'la'],
  'Pacific-Antarctic Ridge': ['Dorsal Pacífico-Antártica', 'la'],
  'Indian-Antarctic Ridge': ['Dorsal Índico-Antártica', 'la'],
  'Southwest Indian Ridge': ['Dorsal Índica Suroccidental', 'la'],
  'southeast Indian Ridge': ['Dorsal Índica Suroriental', 'la'],
  'Southeast Indian Ridge': ['Dorsal Índica Suroriental', 'la'],
  'Reykjanes Ridge': ['Dorsal de Reykjanes', 'la'],
  'West Chile Rise': ['Dorsal de Chile Occidental', 'la'],
  'Chile Rise': ['Dorsal de Chile', 'la'],
  'Carlsberg Ridge': ['Dorsal de Carlsberg', 'la'],
  'Owen Fracture Zone': ['Zona de Fractura de Owen', 'la'],
  'Indian Ocean Triple Junction': ['Punto triple del océano Índico', 'el'],
  'Galapagos Triple Junction': ['Punto triple de Galápagos', 'el'],
  'Knipovich Ridge': ['Dorsal de Knipovich', 'la'],
  'Gakkel Ridge': ['Dorsal de Gakkel', 'la'],
  // Islas y archipiélagos
  'Kermadec Islands': ['Islas Kermadec', 'las'],
  'Bonin Islands': ['Islas Bonin', 'las'],
  'South Sandwich Islands': ['Islas Sandwich del Sur', 'las'],
  'Fiji Islands': ['Islas Fiyi', 'las'],
  'Izu Islands': ['Islas Izu', 'las'],
  'Kuril Islands': ['Islas Kuriles', 'las'],
  'Mariana Islands': ['Islas Marianas', 'las'],
  'Volcano Islands': ['Islas Volcano', 'las'],
  'Loyalty Islands': ['Islas de la Lealtad', 'las'],
  'Balleny Islands': ['Islas Balleny', 'las'],
  'Nicobar Islands': ['Islas Nicobar', 'las'],
  'Andaman Islands': ['Islas Andamán', 'las'],
  'Rat Islands': ['Islas Rat', 'las'],
  'Near Islands': ['Islas Near', 'las'],
  'Fox Islands': ['Islas Fox', 'las'],
  'Andreanof Islands': ['Islas Andreanof', 'las'],
  'Aleutian Islands': ['Islas Aleutianas', 'las'],
  'South Shetland Islands': ['Islas Shetland del Sur', 'las'],
  'Azores Islands': ['Islas Azores', 'las'],
  'Prince Edward Islands': ['Islas Príncipe Eduardo', 'las'],
  'Auckland Islands': ['Islas Auckland', 'las'],
  'Maug Islands': ['Islas Maug', 'las'],
  'Revilla Gigedo Islands': ['Islas Revillagigedo', 'las'],
  'Santa Cruz Islands': ['Islas Santa Cruz', 'las'],
  'Ryukyu Islands': ['Islas Ryukyu', 'las'],
  'Galapagos Islands': ['Islas Galápagos', 'las'],
  'Tonga Islands': ['Islas Tonga', 'las'],
  'Samoa Islands': ['Islas Samoa', 'las'],
  'Philippine Islands': ['Islas Filipinas', 'las'],
  'Kepulauan Babar': ['Islas Babar', 'las'],
  'Kepulauan Talaud': ['Islas Talaud', 'las'],
  'Kepulauan Barat Daya': ['Islas Barat Daya', 'las'],
  'Pulau Pulau Tanimbar': ['Islas Tanimbar', 'las'],
  'Pulau-Pulau Sula': ['Islas Sula', 'las'],
  'Pulau-Pulau Talaud': ['Islas Talaud', 'las'],
  'Komandorskiye Ostrova': ['Islas del Comandante', 'las'],
  'Chagos Archipelago': ['Archipiélago de Chagos', 'el'],
  'Easter Island': ['Isla de Pascua', 'la'],
  'Macquarie Island': ['Isla Macquarie', 'la'],
  'Ascension Island': ['Isla Ascensión', 'la'],
  'Bouvet Island': ['Isla Bouvet', 'la'],
  'South Georgia Island': ['Isla Georgia del Sur', 'la'],
  'North Island of New Zealand': ['Isla Norte de Nueva Zelanda', 'la'],
  'South Island of New Zealand': ['Isla Sur de Nueva Zelanda', 'la'],
  'Tristan da Cunha': ['Tristán de Acuña', ''],
  'Mauritius - Reunion': ['Mauricio - Reunión', ''],
  'Severnaya Zemlya': ['Tierra del Norte', 'la'],
  'Svalbard': ['Svalbard', ''],
  'New Britain': ['Nueva Bretaña', ''],
  'New Ireland': ['Nueva Irlanda', ''],
  'New Guinea': ['Nueva Guinea', ''],
  'Honshu': ['Honshu', ''],
  'Hokkaido': ['Hokkaido', ''],
  'Kyushu': ['Kiushu', ''],
  'Luzon': ['Luzón', ''],
  'Mindanao': ['Mindanao', ''],
  'Java': ['Java', ''],
  'Sumatra': ['Sumatra', ''],
  'Halmahera': ['Halmahera', ''],
  'Pagan': ['Pagan', ''],
  'Alamagan': ['Alamagan', ''],
  'State of Yap': ['Estado de Yap', 'el'],
  // Mares, océanos y pasos
  'Banda Sea': ['Mar de Banda', 'el'],
  'Molucca Sea': ['Mar de las Molucas', 'el'],
  'Scotia Sea': ['Mar de Escocia', 'el'],
  'Greenland Sea': ['Mar de Groenlandia', 'el'],
  'Norwegian Sea': ['Mar de Noruega', 'el'],
  'Bering Sea': ['Mar de Bering', 'el'],
  'Sea of Okhotsk': ['Mar de Ojotsk', 'el'],
  'Laptev Sea': ['Mar de Láptev', 'el'],
  'Caribbean Sea': ['Mar Caribe', 'el'],
  'Drake Passage': ['Pasaje de Drake', 'el'],
  'Gulf of California': ['Golfo de California', 'el'],
  'Gulf of Alaska': ['Golfo de Alaska', 'el'],
  'Pacific Ocean': ['océano Pacífico', 'el'],
  'South Pacific Ocean': ['océano Pacífico sur', 'el'],
  'North Pacific Ocean': ['océano Pacífico norte', 'el'],
  'South Atlantic Ocean': ['océano Atlántico sur', 'el'],
  'North Atlantic Ocean': ['océano Atlántico norte', 'el'],
  'South Indian Ocean': ['océano Índico sur', 'el'],
  'Indian Ocean': ['océano Índico', 'el'],
  'Arctic Ocean': ['océano Ártico', 'el'],
  'North Indian Ocean': ['océano Índico norte', 'el'],
  'Atlantic Ocean': ['océano Atlántico', 'el'],
  'Ceram Sea': ['Mar de Seram', 'el'],
  'Celebes Sea': ['Mar de Célebes', 'el'],
  'Philippine Sea': ['Mar de Filipinas', 'el'],
  'South China Sea': ['Mar de la China Meridional', 'el'],
  // Regiones continentales y subnacionales
  'Africa': ['África', ''],
  'Central America': ['Centroamérica', ''],
  'Alaska Peninsula': ['Península de Alaska', 'la'],
  'Kamchatka Peninsula': ['Península de Kamchatka', 'la'],
  'Alaska': ['Alaska', ''],
  'Hawaii': ['Hawái', ''],
  'Oregon': ['Oregón', ''],
  'California': ['California', ''],
  'Xizang': ['Xizang (Tíbet)', ''],
  'Qinghai': ['Qinghai', ''],
  'Sichuan': ['Sichuan', ''],
  'Xinjiang': ['Xinjiang', ''],
  'Sichuan-Gansu border': ['frontera Sichuan-Gansu', 'la'],
  'Xinjiang-Xizang border': ['frontera Xinjiang-Xizang', 'la'],
  'Hindu Kush': ['Hindu Kush', 'el'],
  'Papua': ['Papúa', ''],
  'Kepulauan Mentawai': ['Islas Mentawai', 'las'],
  'Michoacan': ['Michoacán', ''],
  'Guerrero': ['Guerrero', ''],
  'Oaxaca': ['Oaxaca', ''],
  'Peru-Ecuador border': ['frontera Perú-Ecuador', 'la'],
  'Maule': ['Maule', ''],
  'Bio-Bio': ['Biobío', ''],
  'Valparaiso': ['Valparaíso', ''],
  'Aisen': ['Aysén', ''],
  'Libertador O\'Higgins': ['Libertador O\'Higgins', ''],
  'Libertador General Bernardo O\'Higgins': ['Libertador General Bernardo O\'Higgins', ''],
};

const DIR: Record<string, string> = {
  north: 'norte', south: 'sur', east: 'este', west: 'oeste',
  northeast: 'noreste', northwest: 'noroeste', southeast: 'sureste', southwest: 'suroeste',
  central: 'centro',
};
const DIRS = 'north|south|east|west|northeast|northwest|southeast|southwest';

// Orden de las reglas: "X of (the)" y las costas antes que los adjetivos sueltos.
const OF_RE = new RegExp(`^(${DIRS}) of (?:the )?(.+)$`);
const COAST_RE = new RegExp(`^(off|near) (?:the )?(?:(${DIRS}) )?coast of (?:the )?(.+)$`, 'i');
const ADJ_RE = /^(central|(?:north|south|east|west|northeast|northwest|southeast|southwest)ern) (.+)$/i;
// Brújula suelta solo en minúscula: en mayúscula es parte del nombre ("South Sandwich Islands").
const BARE_RE = new RegExp(`^(${DIRS}) (.+)$`);

const lookup = (name: string): Entry | null => D[name] ?? null;
const withArt = ([n, a]: Entry) => (a ? `${a} ${n}` : n);
/** "de" + artículo, con la contracción "del". */
const de = (e: Entry) => (e[1] === 'el' ? `del ${e[0]}` : `de ${withArt(e)}`);

/**
 * Traduce un nombre Flinn-Engdahl. `country` traduce los sufijos (", Japan").
 * Devuelve null si la región base no está en el diccionario.
 */
export function translateRegion(place: string, country: (s: string) => string | null): string | null {
  const full = lookup(place);
  if (full) return full[0];

  let m: RegExpExecArray | null;
  if ((m = OF_RE.exec(place))) {
    const r = base(m[2], country);
    return r && `al ${DIR[m[1]]} ${de(r.entry)}${r.tail}`;
  }
  if ((m = COAST_RE.exec(place))) {
    const r = base(m[3], country);
    const coast = `la costa${m[2] ? ' ' + DIR[m[2].toLowerCase()] : ''}`;
    return r && `${m[1].toLowerCase() === 'off' ? 'frente a' : 'cerca de'} ${coast} ${de(r.entry)}${r.tail}`;
  }
  if ((m = ADJ_RE.exec(place))) {
    const r = base(m[2], country);
    const w = m[1].toLowerCase();
    return r && `${DIR[w === 'central' ? w : w.replace(/ern$/, '')]} ${de(r.entry)}${r.tail}`;
  }
  if ((m = BARE_RE.exec(place))) {
    const r = base(m[2], country);
    return r && `${DIR[m[1]]} ${de(r.entry)}${r.tail}`;
  }
  const r = base(place, country);
  return r && `${r.entry[0]}${r.tail}`;
}

/**
 * Parte base: "Bonin Islands, Japan region" → entrada de "Bonin Islands" (como
 * "región de las Islas Bonin") + ", Japón". Los sufijos que no se reconocen quedan igual.
 */
function base(text: string, country: (s: string) => string | null): { entry: Entry; tail: string } | null {
  let t = text.trim();
  const region = / region$/.test(t);
  if (region) t = t.replace(/ region$/, '');
  const parts = t.split(', ');
  const head = parts[0];
  const headRegion = / region$/.test(head);
  const name = headRegion ? head.replace(/ region$/, '') : head;
  const e = lookup(name) ?? (country(name) ? ([country(name)!, ''] as Entry) : null);
  if (!e) return null;
  const entry: Entry = region || headRegion ? [`región ${de(e)}`, 'la'] : e;
  const tail = parts.slice(1).map((p) => {
    const q = p.replace(/ region$/, '');
    return lookup(q)?.[0] ?? country(q) ?? p;
  });
  return { entry, tail: tail.length ? ', ' + tail.join(', ') : '' };
}
