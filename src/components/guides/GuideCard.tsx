'use client';
/*
 * Tarjeta "Qué hacer": las recomendaciones de uno o más peligros en tres momentos (durante, después, antes),
 * el organismo de protección civil del país y sus teléfonos, y el enlace a la guía completa.
 */
import { useState } from 'react';
import Link from 'next/link';
import { AGENCIES, GUIDES, GUIDE_T, type HazardKey } from '@/lib/guides';
import { routePath } from '@/lib/seo';
import type { Lang } from '@/lib/types';

type Tab = 'during' | 'after' | 'before';

/** Enlace a la guía completa de cada peligro (lo arma el servidor con guideLinks, para no mandar los artículos al navegador). */
export type GuideLinks = Partial<Record<HazardKey, { href: string; title: string }>>;

export function GuideCard({ lang, hazards, links, iso3, recent = true }: { lang: Lang; hazards: HazardKey[]; links: GuideLinks; iso3?: string | null; recent?: boolean }) {
  const t = GUIDE_T[lang], g = GUIDES[lang];
  const [tab, setTab] = useState<Tab>(recent ? 'during' : 'before');
  const agency = iso3 ? AGENCIES[iso3] : undefined;
  return (
    <section className="guide" aria-labelledby="guide-h">
      <div className="guide-head">
        <h2 id="guide-h" className="ed-h3">{t.title} <span className="guide-sub">· {recent ? t.recent : t.past}</span></h2>
        <div className="guide-tabs" role="tablist">
          {(['during', 'after', 'before'] as Tab[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t.tabs[k]}</button>
          ))}
        </div>
      </div>
      <div className="guide-body" role="tabpanel">
        {hazards.map((h) => {
          const a = links[h];
          return (
            <div key={h} className="guide-hz">
              {hazards.length > 1 && <h3 className="guide-hz-h">{g[h].title}</h3>}
              <ol className="guide-list">{g[h][tab].map((x) => <li key={x}>{x}</li>)}</ol>
              {a && <Link href={a.href} className="ed-more">{t.full}: {a.title} →</Link>}
            </div>
          );
        })}
      </div>
      {agency && (
        <div className="guide-agency">
          <span><b>{t.agency}:</b> <a href={agency.url} target="_blank" rel="noopener noreferrer">{agency.name} ↗</a></span>
          {agency.phones && (
            <span><b>{t.call}:</b> {agency.phones.map((p) => <a key={p.n} href={`tel:${p.n}`} className="guide-tel">{p.n} <small>{p[lang]}</small></a>)}</span>
          )}
        </div>
      )}
      <p className="ed-note">{t.official} <Link href={`${routePath(lang, 'whatToDo')}#${t.anchors[hazards[0]]}`}>{t.all} →</Link></p>
    </section>
  );
}
