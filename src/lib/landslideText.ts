import type { Lang } from './types';

/*
 * Tipo de deslizamiento y causa tal como los publica el catálogo de NASA (COOLR), traducidos.
 * El catálogo mezcla mayúsculas, espacios y guiones bajos ("Rock fall", "rock_fall"): se normalizan.
 */

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_').replace(/^unkown$/, 'unknown').replace(/^rockfall$/, 'rock_fall');

const CATEGORY: Record<Lang, Record<string, string>> = {
  es: {
    landslide: 'deslizamiento', mudslide: 'alud de barro', rock_fall: 'caída de rocas', rock_slide: 'deslizamiento de rocas',
    debris_flow: 'flujo de detritos', earth_flow: 'flujo de tierra', translational_slide: 'deslizamiento traslacional',
    rotational_slide: 'deslizamiento rotacional', snow_avalanche: 'avalancha de nieve', lahar: 'lahar', creep: 'reptación',
    topple: 'vuelco de rocas', complex: 'complejo', riverbank_collapse: 'derrumbe de la orilla de un río',
  },
  en: {
    landslide: 'landslide', mudslide: 'mudslide', rock_fall: 'rockfall', rock_slide: 'rock slide', debris_flow: 'debris flow',
    earth_flow: 'earth flow', translational_slide: 'translational slide', rotational_slide: 'rotational slide',
    snow_avalanche: 'snow avalanche', lahar: 'lahar', creep: 'creep', topple: 'topple', complex: 'complex', riverbank_collapse: 'riverbank collapse',
  },
};

const TRIGGER: Record<Lang, Record<string, string>> = {
  es: {
    downpour: 'lluvia intensa', rain: 'lluvia', rainfall: 'lluvia', continuous_rain: 'lluvia continua', monsoon: 'monzón', tropical_cyclone: 'ciclón tropical',
    earthquake: 'terremoto', mining: 'minería', construction: 'obra en construcción', flooding: 'inundación', snowfall_snowmelt: 'nieve o deshielo',
    freeze_thaw: 'congelamiento y deshielo', dam_embankment_collapse: 'falla de presa o terraplén', leaking_pipe: 'pérdida de una cañería',
    no_apparent_trigger: 'sin causa aparente', volcano: 'volcán',
  },
  en: {
    downpour: 'downpour', rain: 'rain', rainfall: 'rain', continuous_rain: 'continuous rain', monsoon: 'monsoon', tropical_cyclone: 'tropical cyclone',
    earthquake: 'earthquake', mining: 'mining', construction: 'construction', flooding: 'flooding', snowfall_snowmelt: 'snowfall or snowmelt',
    freeze_thaw: 'freeze-thaw', dam_embankment_collapse: 'dam or embankment collapse', leaking_pipe: 'leaking pipe',
    no_apparent_trigger: 'no apparent trigger', volcano: 'volcano',
  },
};

/** Título del catálogo: si viene cortado con "*" al final, se quita la palabra incompleta y se pone "…". */
export const cleanGlcTitle = (s: string) => s.trim().replace(/\s*\S*\*$/, '…');

/** Tipo traducido; null si el catálogo no lo informa ("unknown", "other" o vacío). */
export function landslideCategory(lang: Lang, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const k = norm(raw);
  return CATEGORY[lang][k] ?? null;
}

export function landslideTrigger(lang: Lang, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const k = norm(raw);
  if (k === 'unknown' || k === 'other') return null;
  return TRIGGER[lang][k] ?? raw.replace(/_/g, ' ');
}
