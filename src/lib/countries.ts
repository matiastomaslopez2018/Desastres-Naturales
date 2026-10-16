import countries from 'i18n-iso-countries';
import type { Lang } from './types';

/**
 * Polígonos de Natural Earth 1:110M sin código numérico ISO. Se asignan según
 * ISO 3166-1, que no los reconoce como estados aparte; Kosovo usa el código
 * provisorio XKX/XK (no oficial en ISO, usado por la UE y el Banco Mundial).
 */
const NE_FALLBACK: Record<string, string> = { 'N. Cyprus': 'CYP', Somaliland: 'SOM', Kosovo: 'XKX' };
const EXTRA_A2: Record<string, string> = { XKX: 'XK' };

export function iso3FromNumeric(numeric: string | number | undefined, neName?: string): string | undefined {
  if (numeric != null) {
    const a3 = countries.numericToAlpha3(String(numeric).padStart(3, '0'));
    if (a3) return a3;
  }
  return neName ? NE_FALLBACK[neName] : undefined;
}

const alpha2 = (iso3: string) => EXTRA_A2[iso3] ?? countries.alpha3ToAlpha2(iso3);

export function isIso3(v: string): boolean {
  const up = v.toUpperCase();
  return /^[A-Z]{3}$/.test(up) && !!alpha2(up);
}

const names = new Map<Lang, Intl.DisplayNames>();

/** Nombre del país en el idioma de la página (CLDR vía Intl). */
export function countryName(iso3: string, lang: Lang): string {
  const up = iso3.toUpperCase();
  const a2 = alpha2(up);
  if (!a2) return up;
  let dn = names.get(lang);
  if (!dn) names.set(lang, (dn = new Intl.DisplayNames([lang], { type: 'region' })));
  return dn.of(a2) ?? up;
}

export const countryPath = (lang: Lang, iso3: string) => `/${lang}/pais/${iso3.toLowerCase()}`;
