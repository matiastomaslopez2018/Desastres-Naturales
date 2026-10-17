'use client';

import { useEffect, useMemo, useState } from 'react';

/*
 * Evolución de un incendio: focos de NASA FIRMS de los últimos 7 días en un mapa chico,
 * coloreados por día, con un deslizador (y "reproducir") para ver hacia dónde avanzó.
 * Si hay perímetro oficial (NIFC, EE. UU.), se dibuja encima.
 */

type Pt = [number, number, string, number];
type Labels = { day: string; play: string; pause: string; all: string; perimeter: string; empty: string; frp: string };

export function FireSpread({ points, center, perimeter, labels, lang }: {
  points: Pt[]; center: [number, number]; perimeter?: GeoJSON.Geometry | null; labels: Labels; lang: string;
}) {
  const days = useMemo(() => [...new Set(points.map((p) => p[2]))].sort(), [points]);
  const [idx, setIdx] = useState(days.length); // days.length = todos
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setIdx((i) => (i >= days.length - 1 ? (setPlaying(false), days.length) : i + 1)), 900);
    return () => clearInterval(id);
  }, [playing, days.length]);

  const W = 520, H = 360, d = 0.4;
  const k = Math.cos((center[1] * Math.PI) / 180);
  const X = (lon: number) => ((lon - (center[0] - d)) / (2 * d)) * W;
  // Proyección local equirectangular con la misma escala en x e y (km): y = H/2 − (lat−lat0)·escala/cos(lat0).
  const s = W / (2 * d); // px por grado de longitud
  const Yk = (lat: number) => H / 2 - ((lat - center[1]) * s) / k;
  const shownDay = idx >= days.length ? null : days[idx];
  const visible = points.filter((p) => shownDay == null || p[2] <= shownDay);
  const color = (day: string) => {
    const i = days.indexOf(day), n = Math.max(1, days.length - 1);
    const t = i / n; // 0 = más viejo, 1 = más reciente
    return `rgb(${Math.round(120 + 135 * t)},${Math.round(110 - 80 * t)},${Math.round(90 - 60 * t)})`;
  };
  const perimPath = (() => {
    if (!perimeter) return '';
    const polys = perimeter.type === 'Polygon' ? [perimeter.coordinates] : perimeter.type === 'MultiPolygon' ? perimeter.coordinates : [];
    return polys.map((poly) => poly.map((ring) => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Yk(y).toFixed(1)}`).join('') + 'Z').join('')).join('');
  })();
  const fmt = (day: string) => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(Date.parse(day));

  if (!points.length) return <p className="ed-note">{labels.empty}</p>;
  return (
    <figure className="fire-spread">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.day}>
        <rect width={W} height={H} className="fs-bg" />
        {perimPath && <path d={perimPath} className="fs-perim" />}
        {visible.map((p, i) => <circle key={i} cx={X(p[0])} cy={Yk(p[1])} r={Math.min(6, 2 + Math.sqrt(p[3]) / 3)} fill={color(p[2])} className="fs-pt"><title>{`${fmt(p[2])} · ${labels.frp} ${p[3]} MW`}</title></circle>)}
        <path d={`M${W / 2 - 6} ${H / 2}h12M${W / 2} ${H / 2 - 6}v12`} className="fs-center" />
        <path d={`M${W - 70} ${H - 16}h${((s * 10) / (111.32 * k)).toFixed(1)}`} className="fs-scale" />
        <text x={W - 70} y={H - 22} className="xsec-tick">10 km</text>
      </svg>
      <div className="fs-controls">
        <button type="button" className="anim-btn" onClick={() => { if (!playing) setIdx(0); setPlaying((x) => !x); }}>{playing ? labels.pause : labels.play}</button>
        <input type="range" min={0} max={days.length} value={idx} onChange={(e) => { setPlaying(false); setIdx(+e.target.value); }} aria-label={labels.day} />
        <span className="ed-note">{shownDay ? `${labels.day}: ${fmt(shownDay)}` : labels.all}</span>
      </div>
      <div className="fs-key">{days.map((day) => <span key={day}><i style={{ background: color(day) }} />{fmt(day)}</span>)}{perimPath && <span><i className="fs-key-perim" />{labels.perimeter}</span>}</div>
    </figure>
  );
}
