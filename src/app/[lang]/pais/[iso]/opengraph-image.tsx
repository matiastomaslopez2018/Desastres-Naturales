import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { countryName, isIso3 } from '@/lib/countries';
import { fmtNum } from '@/lib/format';
import { T, isLang } from '@/lib/i18n';
import { PAPER, SHAPE, isHighlighted, paperStyle, relevance, shapeD, sizeFor } from '@/lib/symbols';
import { countryShape } from '@/lib/server/countries';
import { getCountry } from '@/lib/server/stats';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Atlas de Desastres';

const topo = world as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
const LAND = feature(topo, topo.objects.land);
const BORDERS = mesh(topo, topo.objects.countries, (a, b) => a !== b);
const GRAT = geoGraticule10();
const font = (pkg: string, file: string) => readFile(path.join(process.cwd(), 'node_modules', '@fontsource', pkg, 'files', file));

/** Imagen OG de un país (estilo 2b): globo encuadrado en el país y cifras del último año. */
export default async function CountryOg({ params }: { params: Promise<{ lang: string; iso: string }> }) {
  const { lang: l, iso } = await params;
  const lang = isLang(l) ? l : 'es';
  const t = T[lang];
  const iso3 = isIso3(iso) ? iso.toUpperCase() : null;
  const [data, serif400, serif600, sans400, sans600] = await Promise.all([
    iso3 ? getCountry(iso3, '1y', new Date().getUTCFullYear()).catch(() => null) : null,
    font('newsreader', 'newsreader-latin-400-normal.woff'),
    font('newsreader', 'newsreader-latin-600-normal.woff'),
    font('source-sans-3', 'source-sans-3-latin-400-normal.woff'),
    font('source-sans-3', 'source-sans-3-latin-600-normal.woff'),
  ]);
  const fonts = [
    { name: 'Newsreader', data: serif400, weight: 400 as const, style: 'normal' as const },
    { name: 'Newsreader', data: serif600, weight: 600 as const, style: 'normal' as const },
    { name: 'Source Sans 3', data: sans400, weight: 400 as const, style: 'normal' as const },
    { name: 'Source Sans 3', data: sans600, weight: 600 as const, style: 'normal' as const },
  ];
  const nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const name = iso3 ? countryName(iso3, lang) : t.brand;
  const stats = data?.stats;

  // Globo encuadrado en el país (misma lógica que CountryGlobe), con los eventos más relevantes.
  const G = 540, R0 = (G / 2) * 0.9;
  const shape = iso3 ? countryShape(iso3) : null;
  const proj = geoOrthographic().clipAngle(90).precision(0.6).rotate(shape ? [-shape.centroid[0], -shape.centroid[1]] : [70, -8]);
  const fc = { type: 'FeatureCollection' as const, features: shape?.features ?? [] };
  if (shape) proj.fitExtent([[G * 0.2, G * 0.2], [G * 0.8, G * 0.8]], fc);
  proj.scale(Math.min(Math.max(proj.scale(), R0), R0 * 9)).translate([G / 2, G / 2]);
  const p = geoPath(proj);
  const k = Math.min(proj.scale() / R0, 4);
  const evs = (data?.events ?? []).slice().sort((a, b) => relevance(b) - relevance(a)).slice(0, 400).reverse();

  const figures = [
    { label: t.col.alerts, value: nf(stats?.alerts ?? 0), red: (stats?.red ?? 0) > 0 },
    { label: t.col.total, value: nf(stats?.total ?? 0) },
    { label: t.col.maxmag, value: stats?.maxEq ? `M ${nf(stats.maxEq.mag ?? 0, 1)}` : '—', red: (stats?.maxEq?.mag ?? 0) >= 6 },
  ];

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER.bg, color: PAPER.ink, fontFamily: 'Source Sans 3' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '22px 44px 16px', borderBottom: `1.5px solid ${PAPER.ink}` }}>
          <span style={{ fontFamily: 'Newsreader', fontWeight: 600, fontSize: 32 }}>{t.brand}</span>
          <span style={{ fontSize: 20, color: PAPER.muted }}>USGS · NASA EONET · GDACS</span>
        </div>
        <div style={{ flex: 1, display: 'flex', padding: '18px 44px 0' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 22, paddingRight: 24 }}>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: PAPER.red }}>
              {`${t.countryKicker} · ${t.inRange['1y']}`}
            </div>
            <div style={{ display: 'flex', fontFamily: 'Newsreader', fontSize: name.length > 18 ? 64 : 88, lineHeight: 1, marginTop: 12 }}>{name}</div>
            <div style={{ display: 'flex', gap: 36, marginTop: 40 }}>
              {figures.map((f) => (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: PAPER.muted }}>{f.label}</span>
                  <span style={{ fontFamily: 'Newsreader', fontSize: 64, lineHeight: 1.05, color: f.red ? PAPER.red : PAPER.ink }}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
          <svg width={G} height={G} viewBox={`0 0 ${G} ${G}`}>
            <path d={p({ type: 'Sphere' }) ?? ''} fill={PAPER.sphere} />
            <path d={p(GRAT) ?? ''} fill="none" stroke={PAPER.grat} strokeWidth={0.7} />
            <path d={p(LAND) ?? ''} fill={PAPER.land} />
            <path d={p(BORDERS) ?? ''} fill="none" stroke={PAPER.borders} strokeWidth={0.9} />
            {shape && <path d={p(fc) ?? ''} fill={PAPER.bg} stroke={PAPER.ink} strokeWidth={1.6} />}
            {evs.map((e) => {
              const xy = proj([e.lon, e.lat]);
              if (!xy || !p({ type: 'Point', coordinates: [e.lon, e.lat] })) return null;
              const st = paperStyle(e);
              const sh = SHAPE[e.type];
              return (
                <path key={e.id} d={shapeD(sh, xy[0], xy[1], sizeFor(e, k) * 1.3)} fill={sh === 'cross' ? 'none' : st.fill}
                  fillOpacity={st.fillOpacity} stroke={st.stroke} strokeOpacity={isHighlighted(e) ? 1 : 0.6} strokeWidth={1} />
              );
            })}
            <path d={p({ type: 'Sphere' }) ?? ''} fill="none" stroke={PAPER.ink} strokeOpacity={0.6} strokeWidth={1.2} />
          </svg>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
