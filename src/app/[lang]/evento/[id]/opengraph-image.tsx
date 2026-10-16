import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { T, isLang } from '@/lib/i18n';
import { headlineMag } from '@/lib/eventText';
import { fmtTime } from '@/lib/format';
import { globePaths } from '@/lib/globeSvg';
import { COL, SHAPE, fillFor, shapeD } from '@/lib/symbols';
import { getPlates } from '@/lib/server/ingest';
import { loadEvent } from './data';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Atlas de Desastres';

const font = (file: string) =>
  readFile(path.join(process.cwd(), 'node_modules', '@fontsource', file.startsWith('barlow-condensed') ? 'barlow-condensed' : 'barlow', 'files', file));

export default async function OgImage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: l, id } = await params;
  const lang = isLang(l) ? l : 'es';
  const t = T[lang];
  const [found, plates, cond600, body400] = await Promise.all([
    loadEvent(id).catch(() => null),
    getPlates().catch(() => undefined),
    font('barlow-condensed-latin-600-normal.woff'),
    font('barlow-latin-400-normal.woff'),
  ]);
  const fonts = [
    { name: 'Barlow Condensed', data: cond600, weight: 600 as const, style: 'normal' as const },
    { name: 'Barlow', data: body400, weight: 400 as const, style: 'normal' as const },
  ];

  const G = 560;
  const e = found?.event;
  const g = globePaths(e?.lon ?? -70, e?.lat ?? -8, G, plates, e?.track);
  const st = e ? fillFor(e) : null;
  const sh = e ? SHAPE[e.type] : 'circle';
  const s = 22;
  const mark = (a: number, b: number) => `M${a - 7} ${b}h14M${a} ${b - 7}v14`;
  const big = e ? headlineMag(lang, e) : '';
  const alertText = e?.alert ? `GDACS · ${e.alert.toUpperCase()}` : e?.pager ? `USGS PAGER · ${e.pager.toUpperCase()}` : '';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: COL.bg, color: COL.text, fontFamily: 'Barlow', padding: 35 }}>
        <svg width={G} height={G} viewBox={`0 0 ${G} ${G}`}>
          <path d={g.sphere} fill={COL.bg} />
          <path d={g.grat} fill="none" stroke={COL.n300} strokeWidth={0.7} />
          <path d={g.land} fill={COL.n300} />
          <path d={g.borders} fill="none" stroke={COL.n500} strokeWidth={0.6} />
          {g.plates && <path d={g.plates} fill="none" stroke={COL.a700} strokeWidth={1} strokeDasharray="5 4" />}
          <path d={g.sphere} fill="none" stroke={COL.text} strokeOpacity={0.55} strokeWidth={1.2} />
          {g.track && <path d={g.track} fill="none" stroke={COL.a700} strokeWidth={1.5} strokeOpacity={0.7} />}
          {e && st && (
            <g>
              <path d={shapeD(sh, g.x, g.y, 12)} fill={sh === 'cross' ? 'none' : st.fill === COL.tint ? COL.a300 : st.fill} stroke={st.stroke} strokeWidth={sh === 'cross' ? 2.5 : 1.5} />
              <rect x={g.x - s} y={g.y - s} width={s * 2} height={s * 2} fill="none" stroke={COL.text} strokeOpacity={0.4} />
              <path d={[mark(g.x - s, g.y - s), mark(g.x + s, g.y - s), mark(g.x - s, g.y + s), mark(g.x + s, g.y + s)].join('')} stroke={COL.text} strokeWidth={1.2} />
            </g>
          )}
        </svg>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingLeft: 40, paddingTop: 10 }}>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 3, textTransform: 'uppercase', color: COL.a700 }}>
            {e ? `${t.T1[e.type]} · ${e.src}` : t.brandSub}
          </div>
          {big && (
            <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: e?.type === 'eq' ? 150 : 90, lineHeight: 1, marginTop: 14 }}>
              {big}
            </div>
          )}
          <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: e ? (e.title.length > 60 ? 42 : 52) : 72, lineHeight: 1.08, marginTop: 14, textTransform: e ? 'none' : 'uppercase' }}>
            {e ? e.title : t.notFoundTitle}
          </div>
          {e && (
            <div style={{ display: 'flex', fontSize: 24, color: '#5d5d60', marginTop: 18 }}>
              {[e.country, fmtTime(lang, e.start ?? e.time, 'UTC')].filter(Boolean).join(' · ')}
            </div>
          )}
          {alertText && (
            <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 20, padding: '8px 14px', background: '#eef6ff', color: COL.a800, fontSize: 22, letterSpacing: 2 }}>
              {alertText}
            </div>
          )}
          <div style={{ flex: 1, display: 'flex' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `1px solid ${COL.n400}`, paddingTop: 16 }}>
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 30, letterSpacing: 1.5, textTransform: 'uppercase' }}>{t.brand}</span>
            <span style={{ fontSize: 18, color: '#5d5d60' }}>{e ? `${t.sourceLine}: ${e.src}` : ''}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
