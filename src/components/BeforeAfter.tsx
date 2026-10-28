'use client';
/*
 * Antes y después por satélite: dos mapas sincronizados con imágenes HLS (Harmonized Landsat Sentinel-2 de la
 * NASA, 30 m, vía GIBS) y una cortina que se arrastra para comparar. Las fechas las elige /api/sat-dates: la
 * pasada con pocas nubes más cercana antes del evento y la primera después.
 */
import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fmtDay } from '@/lib/format';
import type { Lang } from '@/lib/types';

type Pass = { date: string; coll: 'S30' | 'L30'; cloud: number };
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
const tiles = (p: Pass) => `${GIBS}/HLS_${p.coll}_Nadir_BRDF_Adjusted_Reflectance/default/${p.date}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png`;

const T = {
  es: {
    title: 'De cerca: antes y después a 30 m', loading: 'Buscando imágenes sin nubes…', none: 'No hay imágenes satelitales con pocas nubes de esta zona para antes y después del evento (o todavía no se publicaron: tardan unos días).',
    noAfter: 'Todavía no hay una imagen posterior con pocas nubes (se publican con algunos días de demora). Se muestra la de antes.',
    before: 'Antes', after: 'Después', sat: { S30: 'Sentinel-2', L30: 'Landsat' }, cloud: (b: number, a: number | null) => `Nubes en la zona: ${b} % antes${a != null ? ` y ${a} % después` : ''}.`,
    drag: 'Arrastrá la línea para comparar', help: 'Imágenes en color real de 30 m por píxel: cada píxel es un cuadrado de 30 por 30 metros. Las zonas quemadas se ven oscuras o marrones; el agua que cubre campos y calles, marrón o azul oscuro; la ceniza y la lava, gris o negra. Puede haber nubes o franjas sin datos.',
    credit: 'Imágenes: NASA HLS (Harmonized Landsat Sentinel-2) vía NASA GIBS; Landsat (NASA/USGS) y Sentinel-2 (Copernicus, ESA).',
  },
  en: {
    title: 'Up close: before and after at 30 m', loading: 'Looking for cloud-free images…', none: 'There are no low-cloud satellite images of this area for before and after the event (or they have not been published yet: they take a few days).',
    noAfter: 'There is no low-cloud image after the event yet (they are published a few days later). The before image is shown.',
    before: 'Before', after: 'After', sat: { S30: 'Sentinel-2', L30: 'Landsat' }, cloud: (b: number, a: number | null) => `Cloud in the area: ${b}% before${a != null ? ` and ${a}% after` : ''}.`,
    drag: 'Drag the line to compare', help: 'True-colour images at 30 m per pixel: each pixel is a 30 by 30 metre square. Burnt areas look dark or brown; water over fields and streets, brown or dark blue; ash and lava, grey or black. There may be clouds or stripes with no data.',
    credit: 'Imagery: NASA HLS (Harmonized Landsat Sentinel-2) via NASA GIBS; Landsat (NASA/USGS) and Sentinel-2 (Copernicus, ESA).',
  },
};

export function BeforeAfter({ lang, lon, lat, start, end }: { lang: Lang; lon: number; lat: number; start: number; end: number }) {
  const t = T[lang];
  const [dates, setDates] = useState<{ before: Pass | null; after: Pass | null } | 'loading' | null>('loading');
  const [pos, setPos] = useState(50);
  const boxA = useRef<HTMLDivElement>(null), boxB = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ok = true;
    fetch(`/api/sat-dates?lon=${lon}&lat=${lat}&start=${start}&end=${end}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { if (ok) setDates(j); }).catch(() => { if (ok) setDates(null); });
    return () => { ok = false; };
  }, [lon, lat, start, end]);

  const before = dates && dates !== 'loading' ? dates.before : null, after = dates && dates !== 'loading' ? dates.after : null;

  // Dos mapas, uno encima del otro; al mover cualquiera, el otro copia la cámara.
  useEffect(() => {
    if (!before || !boxA.current || !boxB.current) return;
    let dead = false;
    const maps: MLMap[] = [];
    import('maplibre-gl').then((ml) => {
      if (dead || !boxA.current || !boxB.current) return;
      ml.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());
      const make = (el: HTMLDivElement, p: Pass) => new ml.Map({
        container: el, center: [lon, lat], zoom: 11, maxZoom: 15, minZoom: 6, attributionControl: false, dragRotate: false, pitchWithRotate: false,
        style: { version: 8, sources: { hls: { type: 'raster', tiles: [tiles(p)], tileSize: 256, maxzoom: 12 } },
          layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#2b2b2b' } }, { id: 'hls', type: 'raster', source: 'hls' }] },
      });
      const a = make(boxA.current, before), b = make(boxB.current, after ?? before);
      maps.push(a, b);
      let lock = false;
      const sync = (from: MLMap, to: MLMap) => from.on('move', () => {
        if (lock) return;
        lock = true; to.jumpTo({ center: from.getCenter(), zoom: from.getZoom() }); lock = false;
      });
      sync(a, b); sync(b, a);
      b.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
    });
    return () => { dead = true; maps.forEach((m) => m.remove()); };
  }, [before, after, lon, lat]);

  const label = (p: Pass, k: string) => `${k} · ${fmtDay(lang, Date.parse(`${p.date}T12:00:00Z`))} · ${t.sat[p.coll]}`;

  return (
    <section className="ev-extra hls">
      <h3 className="ev-extra-title">{t.title}</h3>
      {dates === 'loading' ? <p className="ed-note">{t.loading}</p> : !before ? <p className="ed-note">{t.none}</p> : (
        <>
          {!after && <p className="ed-note">{t.noAfter}</p>}
          <div className="hls-wrap">
            <div ref={boxA} className="hls-map" />
            <div ref={boxB} className="hls-map" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
            {after && <>
              <div className="hls-line" style={{ left: `${pos}%` }} aria-hidden="true" />
              <span className="hls-tag hls-tag-l">{label(before, t.before)}</span>
              <span className="hls-tag hls-tag-r">{label(after, t.after)}</span>
            </>}
            {!after && <span className="hls-tag hls-tag-l">{label(before, t.before)}</span>}
          </div>
          {after && <input className="hls-range" type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} aria-label={t.drag} />}
          <p className="ed-note">{t.help} {t.cloud(before.cloud, after?.cloud ?? null)}</p>
          <p className="faint small">{t.credit}</p>
        </>
      )}
    </section>
  );
}
