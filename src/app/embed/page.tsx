import Script from 'next/script';
import { recentEvents } from '@/lib/server/landing';
import { countryName } from '@/lib/countries';
import { localTitle } from '@/lib/localize';
import { fmtNum, fmtTime } from '@/lib/format';
import { SITE_URL } from '@/lib/site';
import { WIDGET_TEXT, parseWidget } from '@/lib/widget';
import type { DisasterEvent } from '@/lib/types';
import './widget.css';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const COLOR: Record<string, string> = { eq: '#e8590c', volcano: '#d6336c', fire: '#f59f00', storm: '#228be6', flood: '#12b886', drought: '#b08c4a' };
/** Color de la magnitud: verde, amarillo, naranja y rojo. */
const magColor = (m: number) => (m >= 6 ? '#c8102e' : m >= 5 ? '#e8590c' : m >= 4 ? '#e0a800' : '#5c940d');

export async function generateMetadata({ searchParams }: Props) {
  const p = parseWidget(await searchParams);
  return { title: `${WIDGET_TEXT[p.lang].types[p.type]} · Mapa de Desastres` };
}

/*
 * Hora relativa en el idioma del widget, recarga cada 2 minutos y alto para el iframe (public/embed.js). El alto
 * se repite unos segundos por si la página que lo contiene todavía no cargó su script.
 */
const script = (lang: string) => `(function(){
var rtf=new Intl.RelativeTimeFormat(${JSON.stringify(lang)},{numeric:"auto"});
function rel(){document.querySelectorAll("time[data-t]").forEach(function(el){var s=(+el.dataset.t-Date.now())/1000,a=Math.abs(s);
el.textContent=a<3600?rtf.format(Math.round(s/60),"minute"):a<86400?rtf.format(Math.round(s/3600),"hour"):rtf.format(Math.round(s/86400),"day");});}
function h(){try{parent.postMessage({type:"mapa-desastres:height",height:document.documentElement.scrollHeight},"*");}catch(e){}}
rel();h();setInterval(rel,30000);window.addEventListener("load",h);window.addEventListener("resize",h);
if(window.ResizeObserver)new ResizeObserver(h).observe(document.body);
var k=0,iv=setInterval(function(){h();if(++k>5)clearInterval(iv);},1500);
setTimeout(function(){location.reload();},120000);})();`;

/*
 * Widget de eventos recientes para insertar en otro sitio con un <iframe>. Toma los mismos datos que el mapa
 * (caché de 2 minutos), se recarga solo cada 2 minutos y le avisa su alto a la página que lo contiene.
 */
export default async function EmbedPage({ searchParams }: Props) {
  const p = parseWidget(await searchParams), t = WIDGET_TEXT[p.lang], lang = p.lang;
  const { events } = await recentEvents(p.range);
  const list = events
    .filter((e: DisasterEvent) => (p.type === 'all' || e.type === p.type) && (!p.country || e.iso3 === p.country) && (e.type !== 'eq' || (e.mag ?? 0) >= p.min))
    .sort((a, b) => b.time - a.time).slice(0, p.n);
  const where = p.country ? t.inCountry(countryName(p.country, lang)) : t.world;
  return (
    <div className="wg" data-theme={p.theme} lang={lang}>
      <header className="wg-head">
        <span className="wg-live"><i />{t.live}</span>
        <h1>{t.types[p.type]} {where}</h1>
        <p>{t.ranges[p.range]}{p.type === 'eq' || p.type === 'all' ? ` · ${t.from(fmtNum(lang, p.min, 1))}` : ''}</p>
      </header>
      {list.length ? (
        <ol className="wg-list">
          {list.map((e) => (
            <li key={e.id}>
              <a href={`${SITE_URL}/${lang}/evento/${encodeURIComponent(e.id)}`} target="_blank" rel="noopener">
                {e.type === 'eq' && e.mag != null
                  ? <b className="wg-mag" style={{ background: magColor(e.mag) }}>{fmtNum(lang, e.mag, 1)}</b>
                  : <b className="wg-mag wg-dot" style={{ background: COLOR[e.type] }} aria-hidden="true" />}
                <span className="wg-text">
                  <span className="wg-title">{localTitle(e, lang)}</span>
                  <span className="wg-meta">
                    {/* El script cambia este texto por la hora relativa: React no lo tiene que corregir al hidratar. */}
                    <time dateTime={new Date(e.time).toISOString()} data-t={e.time} suppressHydrationWarning>{fmtTime(lang, e.time, 'UTC')}</time>
                    {e.type === 'eq' && e.depth != null ? ` · ${t.depth(fmtNum(lang, e.depth))}` : ''}{e.src !== 'USGS' ? ` · ${e.src}` : ''}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      ) : <p className="wg-none">{t.none}</p>}
      <footer className="wg-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href={`${SITE_URL}/${lang}`} target="_blank" rel="noopener"><img src={`${SITE_URL}/icons/icon-192.png`} alt="" width={16} height={16} /> Mapa de Desastres · {t.more} →</a>
        <span>{t.sources}</span>
      </footer>
      {/* Después de la hidratación, para que React no deshaga los cambios de texto. */}
      <Script id="wg-live" strategy="afterInteractive">{script(lang)}</Script>
    </div>
  );
}
