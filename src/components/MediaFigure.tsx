'use client';

import { useEffect, useState } from 'react';
import { T } from '@/lib/i18n';
import type { Lang, MediaImage } from '@/lib/types';

/*
 * Imagen de la ficha con crédito y licencia siempre visibles debajo. Los datos vienen de
 * /api/images (resueltos y guardados en la base). Si hay varias, se elige con pestañas;
 * la satelital de GIBS con imagen anterior se compara con un deslizador antes/después.
 */

/** Qué ficha: `event=id`, `volcano=número GVP`, `storm=nhc-…` o `country=ISO3`. */
export type MediaQuery = { event: string } | { volcano: number } | { storm: string } | { country: string };

const SIZES = '(max-width: 760px) 100vw, 640px';

export function MediaFigure({ lang, q }: { lang: Lang; q: MediaQuery }) {
  const t = T[lang].media;
  const key = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString();
  const [images, setImages] = useState<MediaImage[] | null | undefined>(undefined);
  const [i, setI] = useState(0);
  const [pos, setPos] = useState(50);

  useEffect(() => {
    setImages(undefined); setI(0); setPos(50);
    const ctrl = new AbortController();
    fetch(`/api/images?${key}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { images: MediaImage[] }) => setImages(j.images.length ? j.images : null))
      .catch(() => { if (!ctrl.signal.aborted) setImages(null); });
    return () => ctrl.abort();
  }, [key]);

  if (images === null) return null;
  if (images === undefined) return <div className="media media-wait" aria-hidden="true" />;

  const m = images[Math.min(i, images.length - 1)];
  const day = (d: string) => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(d));
  const img = (src: string, small: string | undefined, alt: string, cls?: string, style?: React.CSSProperties) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} srcSet={small ? `${small} 640w, ${src} ${m.width ?? 960}w` : undefined} sizes={small ? SIZES : undefined}
      width={m.width} height={m.height} alt={alt} loading="lazy" decoding="async" className={cls} style={style} />
  );

  const caption =
    m.kind === 'gibs' ? [m.date ? t.gibs(m.detail ?? '', day(m.date)) : m.detail, m.fires ? t.fires : ''].filter(Boolean).join(' · ')
      : m.kind === 'goes' ? t.goesLive
      : m.kind === 'shakemap' ? t.shakemap
      : m.kind === 'eo' ? `${m.detail}${m.date ? ` · ${day(m.date)}` : ''}`
      : '';

  return (
    <figure className="media">
      {images.length > 1 && (
        <div className="media-tabs" role="tablist" aria-label={t.label}>
          {images.map((x, k) => (
            <button key={x.kind + k} role="tab" aria-selected={k === i} className="media-tab" onClick={() => { setI(k); setPos(50); }}>
              {t.tab[x.kind]}
            </button>
          ))}
        </div>
      )}
      <div className={`media-frame media-${m.kind}`} style={m.width && m.height ? { aspectRatio: `${m.width} / ${m.height}` } : undefined}>
        {m.before ? (
          <div className="ba">
            {img(m.src, m.srcSmall, m.alt)}
            {img(m.before.src, m.before.srcSmall, `${t.before}: ${m.before.detail}, ${m.before.date}`, 'ba-before', { clipPath: `inset(0 ${100 - pos}% 0 0)` })}
            <span className="ba-line" style={{ left: `${pos}%` }} aria-hidden="true" />
            <span className="ba-tag ba-l">{t.before} · {day(m.before.date)}</span>
            <span className="ba-tag ba-r">{t.after} · {m.date ? day(m.date) : ''}</span>
            <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} aria-label={t.slider} className="ba-range" />
          </div>
        ) : img(m.src, m.srcSmall, m.alt)}
      </div>
      <figcaption className="media-credit">
        {caption && <span className="media-cap">{caption}</span>}
        <span>
          {m.kind === 'commons' ? t.photo : t.image}: {m.credit}
          {' · '}{t.license}:{' '}
          {m.licenseKind ? t.lic[m.licenseKind]
            : m.licenseUrl ? <a href={m.licenseUrl} target="_blank" rel="noopener noreferrer license">{m.license}</a> : m.license}
          {' · '}<a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">{m.sourceLabel} <span aria-hidden="true">↗</span></a>
        </span>
      </figcaption>
    </figure>
  );
}
