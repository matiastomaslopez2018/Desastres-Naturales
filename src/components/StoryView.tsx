'use client';
/*
 * Historia con scroll: el mapa queda fijo mientras pasan los pasos del texto; al llegar a cada paso, el mapa viaja
 * (centro y escala) y muestra sus marcas. Mapa en canvas con la misma proyección que «Mi lugar».
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { geoPath } from 'd3-geo';
import { drawBase, loadGeo, placeProjection } from './place/PlaceMap';
import { prep, useCanvasSize } from './quake/clock';
import type { Story } from '@/lib/stories';
import type { Lang } from '@/lib/types';

type View = { lon: number; lat: number; halfKm: number };
const T = { es: { more: 'Seguir explorando', sources: 'Fuentes' }, en: { more: 'Keep exploring', sources: 'Sources' } };

export function StoryView({ lang, story }: { lang: Lang; story: Story }) {
  const t = T[lang];
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLElement | null)[]>([]);
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);
  const [geo, setGeo] = useState<Awaited<ReturnType<typeof loadGeo>> | null>(null);
  useEffect(() => { loadGeo().then(setGeo).catch(() => {}); }, []);
  const [view, setView] = useState<View>(story.steps[0].view);

  // Paso activo: el que cruza la mitad de la pantalla.
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [story]);

  // Viaje del mapa: interpolación en 0,9 s (la escala, en logaritmo, para que el zoom se vea parejo).
  const viewRef = useRef(view);
  useEffect(() => {
    const to = story.steps[active].view, from = viewRef.current;
    const set = (v: View) => { viewRef.current = v; setView(v); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { set(to); return; }
    let dl = to.lon - from.lon;
    if (dl > 180) dl -= 360; else if (dl < -180) dl += 360;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / 900), e = u * u * (3 - 2 * u);
      set({ lon: from.lon + dl * e, lat: from.lat + (to.lat - from.lat) * e, halfKm: Math.exp(Math.log(from.halfKm) + (Math.log(to.halfKm) - Math.log(from.halfKm)) * e) });
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, story]);

  useEffect(() => {
    const ctx = prep(cv.current, w, h, dpr);
    if (!ctx) return;
    const s = Math.min(w, h) / (2 * view.halfKm), proj = placeProjection(view.lon, view.lat, s, w, h);
    ctx.fillStyle = '#cfe0ea'; ctx.fillRect(0, 0, w, h);
    if (geo) drawBase(ctx, geo, proj);
    const path = geoPath(proj, ctx);
    ctx.font = '600 12.5px var(--font-isans), system-ui, sans-serif'; ctx.textBaseline = 'middle';
    for (const m of story.steps[active].marks) {
      const color = m.color ?? '#141414';
      if (m.kind === 'line') {
        ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.globalAlpha = 0.8;
        ctx.beginPath(); path({ type: 'LineString', coordinates: m.coords }); ctx.stroke(); ctx.globalAlpha = 1;
        const p = proj(m.coords[Math.floor(m.coords.length / 2)]);
        if (p && m.label) { ctx.fillStyle = color; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.strokeText(m.label, p[0] + 10, p[1]); ctx.fillText(m.label, p[0] + 10, p[1]); }
        continue;
      }
      const p = proj([m.lon, m.lat]);
      if (!p) continue;
      const r = m.big ? 9 : 5;
      if (m.big) { ctx.fillStyle = color + '33'; ctx.beginPath(); ctx.arc(p[0], p[1], r * 2.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#141414'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
      ctx.strokeText(m.label, p[0] + r + 6, p[1]); ctx.fillText(m.label, p[0] + r + 6, p[1]);
    }
    // Escala.
    const step = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((v) => v * s > 60) ?? 5000;
    ctx.fillStyle = '#141414'; ctx.fillRect(12, h - 16, step * s, 3);
    ctx.font = '11px var(--font-isans), system-ui, sans-serif'; ctx.textBaseline = 'bottom'; ctx.fillText(`${step.toLocaleString(lang === 'es' ? 'es-AR' : 'en-GB')} km`, 12, h - 20);
  }, [w, h, dpr, geo, view, active, story, lang]);

  return (
    <div className="st">
      <div className="st-map">
        <div ref={wrap} className="st-canvas"><canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label={story.steps[active].title} /></div>
      </div>
      <div className="st-steps">
        {story.steps.map((s, i) => (
          <section key={s.title} ref={(el) => { steps.current[i] = el; }} data-i={i} className={`st-step${i === active ? ' on' : ''}`}>
            <h2 className="st-step-h">{s.title}</h2>
            <p>{s.text}</p>
          </section>
        ))}
        <section className="st-end">
          <h2 className="ed-h3">{t.more}</h2>
          <ul className="st-links">{story.links.map((l) => <li key={l.href}><Link href={l.href}>{l.label} →</Link></li>)}</ul>
          <h3 className="qs-h3">{t.sources}</h3>
          <ul className="st-src">{story.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
