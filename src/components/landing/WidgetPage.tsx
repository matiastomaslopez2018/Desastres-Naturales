// Página del configurador del widget para insertar en otros sitios.
import Script from 'next/script';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SeoLinks, seoMeta } from '@/components/landing/Landing';
import { WidgetBuilder } from '@/components/WidgetBuilder';
import { QUAKE_COUNTRIES, routePath } from '@/lib/seo';
import { countryName } from '@/lib/countries';
import { SITE_URL } from '@/lib/site';
import type { Lang } from '@/lib/types';

const T = {
  es: {
    kicker: 'Widget', h1: 'Los sismos en vivo en tu sitio',
    seoTitle: 'Widget gratis de sismos en vivo para tu sitio web',
    desc: 'Insertá en tu sitio o blog la lista en vivo de sismos (o de otros eventos) de tu país, con datos del USGS, INPRES y el CSN. Gratis, sin registro y se actualiza solo.',
    lead: 'Elegí qué mostrar y copiá el código: la lista se actualiza sola cada 2 minutos, con los mismos datos del mapa. Es gratis y no hace falta registrarse.',
    terms: 'Podés usarlo en cualquier sitio, también comercial, siempre que se vea la atribución del pie. Los datos son de USGS, INPRES, el Centro Sismológico Nacional de la Universidad de Chile, NASA EONET y GDACS; cada evento enlaza a su ficha con las fuentes.',
  },
  en: {
    kicker: 'Widget', h1: 'Live earthquakes on your site',
    seoTitle: 'Free live earthquake widget for your website',
    desc: 'Embed the live list of earthquakes (or other events) for your country on your site or blog, with data from USGS, INPRES and CSN. Free, no sign-up, updates itself.',
    lead: 'Choose what to show and copy the code: the list updates itself every 2 minutes, with the same data as the map. It is free and no sign-up is needed.',
    terms: 'You can use it on any site, including commercial ones, as long as the footer credit stays visible. Data come from the USGS, INPRES, the National Seismological Center of the University of Chile, NASA EONET and GDACS; each event links to its page with the sources.',
  },
};

export const widgetMeta = (lang: Lang) => seoMeta(lang, 'widget', T[lang].seoTitle, T[lang].desc);

export function WidgetPage({ lang }: { lang: Lang }) {
  const t = T[lang];
  const countries = QUAKE_COUNTRIES.map((c) => ({ iso3: c.iso3, name: countryName(c.iso3, lang) })).sort((a, b) => a.name.localeCompare(b.name, lang));
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', 'widget'), en: routePath('en', 'widget') }} />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{t.kicker}</span>
          <h1 className="ed-headline">{t.h1}</h1>
          <p className="ed-lead">{t.lead}</p>
        </div>
        <WidgetBuilder lang={lang} site={SITE_URL} countries={countries} />
        <p className="ed-note">{t.terms}</p>
        <SeoLinks lang={lang} current="widget" />
      </main>
      <SiteFooter lang={lang} />
      <Script src="/embed.js" strategy="afterInteractive" />
    </div>
  );
}
