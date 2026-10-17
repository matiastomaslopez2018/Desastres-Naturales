import { VOLC } from '@/lib/geoText';
import { fmtNum, fmtTime } from '@/lib/format';
import { OBSERVATORIES, crustOf, settingOf, usgsAlert, vaacFor, volcanoDetails, volcanoEruptions, type Eruption, type Setting } from '@/lib/server/volcanoContext';
import { translateParagraphs } from '@/lib/server/translate';
import type { GvpVolcano, Lang } from '@/lib/types';

/** Esquema simple de cada tipo de vulcanismo (ilustrativo). */
export function SettingSketch({ kind, label }: { kind: Setting; label: string }) {
  return (
    <svg className="vsk" viewBox="0 0 240 120" role="img" aria-label={label}>
      <rect x="0" y="80" width="240" height="40" className="vsk-mantle" />
      {kind === 'subduction' && (<>
        <path d="M0 62 L120 62 L220 120 L170 120 L105 74 L0 74 Z" className="vsk-ocean" />
        <path d="M120 50 L240 50 L240 80 L170 80 Z" className="vsk-cont" />
        <path d="M165 50 l12 -26 l12 26 Z" className="vsk-volc" />
        <path d="M177 90 C 177 75, 177 60, 177 34" className="vsk-magma" />
        <path d="M40 56 h40 m-6-4 l6 4-6 4" className="vsk-arrow" />
      </>)}
      {kind === 'rift' && (<>
        <path d="M0 58 L110 58 L110 80 L0 80 Z" className="vsk-cont" /><path d="M130 58 L240 58 L240 80 L130 80 Z" className="vsk-cont" />
        <path d="M108 58 l12 -18 l12 18 Z" className="vsk-volc" />
        <path d="M120 112 C 120 90, 120 70, 120 44" className="vsk-magma" />
        <path d="M90 50 h-40 m6-4 l-6 4 6 4 M150 50 h40 m-6-4 l6 4-6 4" className="vsk-arrow" />
      </>)}
      {kind === 'intraplate' && (<>
        <path d="M0 62 L240 62 L240 80 L0 80 Z" className="vsk-ocean" />
        <path d="M150 62 l14 -30 l14 30 Z" className="vsk-volc" /><path d="M90 62 l10 -18 l10 18 Z" className="vsk-old" /><path d="M35 62 l8 -10 l8 10 Z" className="vsk-old" />
        <path d="M164 120 C 160 100, 168 85, 164 40" className="vsk-magma vsk-plume" />
        <path d="M200 70 h-30" className="vsk-arrow" /><path d="M120 72 h-40 m6-4 l-6 4 6 4" className="vsk-arrow" />
      </>)}
    </svg>
  );
}

/** Línea de tiempo: una barra por erupción (desde 1500, o todas si son pocas), alto = VEI. */
function Timeline({ lang, list }: { lang: Lang; list: Eruption[] }) {
  const W = 640, H = 150, L = 30, R = 10, T = 10, B = 26;
  const recent = list.filter((e) => e.year >= 1500);
  const shown = recent.length >= 3 ? recent : list.slice(-40);
  if (!shown.length) return null;
  const y0 = Math.min(...shown.map((e) => e.year)), y1 = Math.max(new Date().getUTCFullYear(), ...shown.map((e) => e.year));
  const X = (y: number) => L + ((y - y0) / Math.max(1, y1 - y0)) * (W - L - R);
  const Y = (v: number) => H - B - (v / 6) * (H - T - B);
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(y0 + ((y1 - y0) * i) / 4));
  const yr = (y: number) => (y < 0 ? `${fmtNum(lang, -y)} ${VOLC[lang].bce}` : String(y));
  return (
    <svg className="vtl" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={VOLC[lang].history}>
      {[0, 2, 4, 6].map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="xsec-grid" /><text x={L - 6} y={Y(v) + 4} textAnchor="end" className="xsec-tick">{v}</text></g>)}
      {ticks.map((y) => <text key={y} x={X(y)} y={H - 8} textAnchor="middle" className="xsec-tick">{yr(y)}</text>)}
      {shown.map((e) => {
        const v = e.vei ?? 0.4;
        return <rect key={e.number} x={X(e.year) - 2} y={Y(v)} width={4} height={Math.max(2, Y(0) - Y(v))} className={e.vei == null ? 'vtl-bar nov' : e.vei >= 4 ? 'vtl-bar big' : 'vtl-bar'}><title>{`${yr(e.year)} · VEI ${e.vei ?? '?'}`}</title></rect>;
      })}
    </svg>
  );
}

const rockKey = (r: string | null) => {
  const s = (r ?? '').toLowerCase();
  return /basalt/.test(s) ? 'basalt' : /andesite/.test(s) ? 'andesite' : /dacite/.test(s) ? 'dacite' : /rhyolite/.test(s) ? 'rhyolite' : /trachyte|phonolite/.test(s) ? 'trachyte' : null;
};

export async function VolcanoGeology({ lang, v }: { lang: Lang; v: GvpVolcano }) {
  const t = VOLC[lang], nf = (x: number) => fmtNum(lang, x);
  const [d, eruptions, alert] = await Promise.all([volcanoDetails(v.num), volcanoEruptions(v.num), usgsAlert(v.num)]);
  const kind = settingOf(d?.setting), crust = crustOf(d?.setting), rock = rockKey(d?.rock ?? null);
  const summary = d?.summary ? [d.summary] : null;
  const translated = lang === 'es' && summary ? await translateParagraphs(`gvp-summary:${v.num}`, summary) : null;
  const obs = v.country ? OBSERVATORIES[v.country] : undefined;
  const vaac = vaacFor(v.lon, v.lat);
  const recent = eruptions.filter((e) => e.year >= 1500);
  const shownFrom = recent.length >= 3 ? 1500 : eruptions.slice(-40)[0]?.year;
  const older = recent.length >= 3 ? eruptions.length - recent.length : Math.max(0, eruptions.length - 40);
  const yr = (y: number) => (y < 0 ? `${nf(-y)} ${t.bce}` : String(y));
  const gvp = `https://volcano.si.edu/volcano.cfm?vn=${v.num}`;

  return (
    <section className="geo" aria-labelledby="vgeo">
      <h2 id="vgeo" className="ed-h3">{lang === 'es' ? 'Contexto geológico' : 'Geological context'}</h2>

      {kind && (
        <div className="geo-block">
          <h3 className="geo-h">{t.setting}</h3>
          <div className="geo-mech">
            <SettingSketch kind={kind} label={t.settingKind[kind].name} />
            <div className="stack-2">
              <p className="geo-kind"><strong>{t.settingKind[kind].name}</strong>{crust && <span className="ed-note"> · {t.crust[crust]}</span>}</p>
              <p>{t.settingKind[kind].text}</p>
              <p className="ed-note">Smithsonian GVP: “{d?.setting}” · <a href={gvp} target="_blank" rel="noopener noreferrer">GVP ↗</a></p>
            </div>
          </div>
        </div>
      )}

      {d?.rock && (
        <div className="geo-block">
          <h3 className="geo-h">{t.rock}</h3>
          <p>{rock ? t.rocks[rock] : t.rockOther} <span className="ed-note">(GVP: {d.rock}{d.elevation != null ? ` · ${t.elevation} ${nf(d.elevation)} m` : ''})</span></p>
        </div>
      )}

      <div className="geo-block">
        <h3 className="geo-h">{t.history}</h3>
        {eruptions.length ? (<>
          <Timeline lang={lang} list={eruptions} />
          <p className="ed-note">{t.historyNote(nf(eruptions.length - older), shownFrom != null ? yr(shownFrom) : '')} {older > 0 && t.historyOlder(nf(older), yr(eruptions[0].year))}</p>
        </>) : <p className="ed-note">{t.noHistory}</p>}
        <details className="geo-orig">
          <summary>{t.vei}</summary>
          <div className="ed-table-wrap">
            <table className="ed-table vei-table">
              <thead><tr>{t.veiCol.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
              <tbody>{t.veiRows.map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="ed-note">{t.veiNote}</p>
        </details>
      </div>

      <div className="geo-block">
        <h3 className="geo-h">{t.alert}</h3>
        {alert ? (
          <p className={`valert valert-${alert.color.toLowerCase()}`}>
            <strong>{t.alertLevels[alert.level] ?? alert.level}</strong> · {t.aviation} {t.colors[alert.color] ?? alert.color} · {alert.observatory}, {fmtTime(lang, alert.sent, 'UTC')}{' · '}
            <a href={alert.url} target="_blank" rel="noopener noreferrer">USGS ↗</a>
          </p>
        ) : obs ? (
          <p>{t.alertPre}<a href={obs.url} target="_blank" rel="noopener noreferrer">{obs.name} ↗</a>. <span className="ed-note">{t.alertPost}</span></p>
        ) : <p className="ed-note">{t.alertNone}</p>}
      </div>

      <div className="geo-block">
        <h3 className="geo-h">{t.vaac}</h3>
        <p>{t.vaacPre}<a href={vaac.url} target="_blank" rel="noopener noreferrer">{vaac.name} ↗</a>.</p>
        <p className="ed-note">{t.vaacNote}</p>
      </div>

      {summary && (
        <div className="geo-block">
          <h3 className="geo-h">{t.summary}</h3>
          {translated ? (<>
            <p>{translated[0]}</p>
            <details className="geo-orig"><summary>{lang === 'es' ? 'Texto original (GVP)' : 'Original text (GVP)'}</summary><p lang="en">{summary[0]}</p></details>
          </>) : <p lang="en">{summary[0]}</p>}
          <p className="ed-note"><a href={gvp} target="_blank" rel="noopener noreferrer">Smithsonian Global Volcanism Program ↗</a></p>
        </div>
      )}
    </section>
  );
}
