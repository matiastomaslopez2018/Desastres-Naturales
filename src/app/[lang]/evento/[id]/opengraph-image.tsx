import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { countryName } from '@/lib/countries';
import { T, isLang } from '@/lib/i18n';
import { headlineMag } from '@/lib/eventText';
import { fmtTime } from '@/lib/format';
import { globePaths } from '@/lib/globeSvg';
import { PAPER, SHAPE, alertLevel, isHighlighted, paperStyle, shapeD } from '@/lib/symbols';
import { getPlates } from '@/lib/server/ingest';
import { loadEvent } from './data';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Atlas de Desastres';

const font = (pkg: string, file: string) => readFile(path.join(process.cwd(), 'node_modules', '@fontsource', pkg, 'files', file));

/** Imagen OG en estilo 2b: papel, Newsreader y un solo rojo. */
export default async function OgImage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: l, id } = await params;
  const lang = isLang(l) ? l : 'es';
  const t = T[lang];
  const [found, plates, serif400, serif600, sans400, sans600] = await Promise.all([
    loadEvent(id).catch(() => null),
    getPlates().catch(() => undefined),
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

  const G = 540;
  const e = found?.event;
  const g = globePaths(e?.lon ?? -70, e?.lat ?? -8, G, plates, e?.track);
  const st = e ? paperStyle(e) : null;
  const sh = e ? SHAPE[e.type] : 'circle';
  const big = e ? headlineMag(lang, e) : '';
  const red = e ? isHighlighted(e) : false;
  const lvl = e ? alertLevel(e) : 0;
  const alertText = e?.alert && lvl >= 2 ? `GDACS · ${e.alert.toUpperCase()}` : e?.pager && lvl >= 2 ? `USGS PAGER · ${e.pager.toUpperCase()}` : '';
  const where = e?.iso3 ? countryName(e.iso3, lang) : e?.country;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER.bg, color: PAPER.ink, fontFamily: 'Source Sans 3' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '22px 44px 16px', borderBottom: `1.5px solid ${PAPER.ink}` }}>
          <span style={{ fontFamily: 'Newsreader', fontWeight: 600, fontSize: 32 }}>{t.brand}</span>
          <span style={{ fontSize: 20, color: PAPER.muted }}>{e ? `${t.sourceLine}: ${e.src}` : t.brandSub}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', padding: '18px 44px 0' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 18, paddingRight: 24 }}>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: PAPER.red }}>
              {e ? [t.T1[e.type], where].filter(Boolean).join(' · ') : t.notFoundTitle}
            </div>
            {big && (
              <div style={{ display: 'flex', fontFamily: 'Newsreader', fontSize: e?.type === 'eq' ? 150 : 96, lineHeight: 1, marginTop: 8, color: red ? PAPER.red : PAPER.ink }}>
                {big}
              </div>
            )}
            <div style={{ display: 'flex', fontFamily: 'Newsreader', fontSize: e ? (e.title.length > 60 ? 40 : 50) : 64, lineHeight: 1.08, marginTop: 10 }}>
              {e ? e.title : t.brand}
            </div>
            {e && (
              <div style={{ display: 'flex', fontSize: 24, color: PAPER.muted, marginTop: 16 }}>
                {fmtTime(lang, e.start ?? e.time, 'UTC')}
              </div>
            )}
            {alertText && (
              <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 18, paddingLeft: 12, borderLeft: `4px solid ${PAPER.red}`, color: PAPER.red, fontSize: 22, fontWeight: 600, letterSpacing: 2 }}>
                {alertText}
              </div>
            )}
          </div>
          <svg width={G} height={G} viewBox={`0 0 ${G} ${G}`} style={{ marginTop: 4 }}>
            <path d={g.sphere} fill={PAPER.sphere} />
            <path d={g.grat} fill="none" stroke={PAPER.grat} strokeWidth={0.7} />
            <path d={g.land} fill={PAPER.land} />
            <path d={g.borders} fill="none" stroke={PAPER.borders} strokeWidth={0.9} />
            {g.plates && <path d={g.plates} fill="none" stroke={PAPER.plates} strokeWidth={1} strokeDasharray="4 4" />}
            <path d={g.sphere} fill="none" stroke={PAPER.ink} strokeOpacity={0.6} strokeWidth={1.2} />
            {g.track && <path d={g.track} fill="none" stroke={PAPER.ink} strokeWidth={1.5} strokeOpacity={0.6} />}
            {e && st && (
              <g>
                <path d={shapeD(sh, g.x, g.y, 12)} fill={sh === 'cross' ? 'none' : st.fill === 'none' ? PAPER.sphere : st.fill}
                  fillOpacity={st.fill === 'none' ? 1 : st.fillOpacity} stroke={st.stroke} strokeWidth={sh === 'cross' ? 2.5 : 1.8} />
                <circle cx={g.x} cy={g.y} r={26} fill="none" stroke={PAPER.ink} strokeWidth={1.4} />
              </g>
            )}
          </svg>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
