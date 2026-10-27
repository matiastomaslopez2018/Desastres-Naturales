'use client';
/* Simulador de sismos: controles, corte de la Tierra, sismograma, edificios y fichas de resultados. */
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { G_CMS2, modelFor, outOfRange, shaking, type Mechanism, type Setting } from '@/lib/quake/gmpe';
import { HIROSHIMA_J, PER_YEAR, energy, scenario, tnt } from '@/lib/quake/source';
import { firstArrival, velocity } from '@/lib/quake/waves';
import { synthesize } from '@/lib/quake/synth';
import { PRESETS, presetDist, type Preset } from '@/lib/quake/presets';
import { MMI_SCALE, MMI_TEXT, ROMAN, SIM_SOURCES, SIM_TEXT } from '@/lib/quake/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { useClock } from './clock';
import Link from 'next/link';
import { routePath } from '@/lib/seo';
import { TSUNAMI_PRESETS } from '@/lib/tsunami/presets';
import { Section, P_RGB, S_RGB } from './Section';
import { Seismogram } from './Seismogram';
import { Buildings, FLOORS, Spectrum, periodOf } from './Buildings';
import { City } from './City';
import { Observed } from './Observed';
import { Particles } from './Particles';
import { VOLC_TEXT } from '@/lib/volcano/text';

export type SimParams = { mag: number; depth: number; dist: number; setting: Setting; mech: Mechanism; vs30: number };
export type SimInitial = Partial<SimParams> & { title?: string; preset?: string };

const DEFAULT: SimParams = { mag: 7.0, depth: 15, dist: 30, setting: 'crustal', mech: 'reverse', vs30: 360 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const fromPreset = (p: Preset): SimParams => ({ mag: p.mag, depth: p.depth, dist: presetDist(p), setting: p.setting, mech: p.mech, vs30: p.vs30 });

/* Escalas logarítmicas de los deslizadores (distancia y Vs30). */
const logTo = (v: number, a: number, b: number) => (Math.log(v / a) / Math.log(b / a)) * 1000;
const logFrom = (s: number, a: number, b: number) => a * (b / a) ** (s / 1000);
const DIST = [1, 500] as const, VS = [150, 1500] as const;

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sci = (lang: Lang, x: number) => {
  const e = Math.floor(Math.log10(x)), m = x / 10 ** e;
  return `${fmtNum(lang, m, 1)} × 10${String(e).split('').map((c) => SUP[+c]).join('')}`;
};
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

export function QuakeSim({ lang, initial }: { lang: Lang; initial?: SimInitial }) {
  const t = SIM_TEXT[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const initPreset = PRESETS.find((p) => p.id === initial?.preset);
  const [p, setP] = useState<SimParams>(() => (initPreset ? fromPreset(initPreset) : {
    mag: clamp(initial?.mag ?? DEFAULT.mag, 4, 9.5), depth: clamp(initial?.depth ?? DEFAULT.depth, 1, 300), dist: clamp(initial?.dist ?? DEFAULT.dist, 1, 500),
    setting: initial?.setting ?? DEFAULT.setting, mech: initial?.mech ?? DEFAULT.mech, vs30: clamp(initial?.vs30 ?? DEFAULT.vs30, 150, 1500),
  }));
  const [preset, setPreset] = useState<Preset | null>(initPreset ?? null);
  const set = (q: Partial<SimParams>) => { setP((o) => ({ ...o, ...q })); setPreset(null); };
  const d = useDeferredValue(p);

  /* ── Cálculo ── */
  const res = useMemo(() => {
    const { s, rup } = scenario(d);
    const site = { vs30: d.vs30 };
    const sh = shaking(s, site);
    const tP = firstArrival('P', d.depth, d.dist), tS = firstArrival('S', d.depth, d.dist);
    const synth = synthesize({
      seed: hash(JSON.stringify(d)), mag: d.mag, dist: d.setting === 'slab' ? s.rhypo : s.rrup,
      beta: velocity(Math.min(d.depth, 60), 'S'), tP: tP.t, tS: tS.t, pga: sh.pga, spectrum: sh.spectrum, buildings: FLOORS.map(periodOf),
    });
    // Ondas superficiales: velocidades de grupo típicas de corteza continental (períodos de 10–20 s);
    // solo se marcan en sismos poco profundos, que son los que las generan con fuerza.
    const surface = d.depth <= 70 ? { tL: d.dist / 3.5, tR: d.dist / 3.0 } : null;
    const end = Math.min(synth.acc.length * synth.dt, Math.max(tS.t + synth.strongDuration * 1.8 + 6, surface ? surface.tR + 8 : 0));
    return { s, rup, sh, tP, tS, surface, synth, end, oor: outOfRange(s, site), seed: hash(JSON.stringify(d)) };
  }, [d]);

  const clock = useClock(res.end);
  const { seek, setSpeed } = clock;
  // Al cambiar el escenario: pausa, cuadro poco después de que la S pasa por el lugar (se ve la fase fuerte)
  // y velocidad para que la animación dure ~20 s.
  // `armed`: el cuadro en reposo es una vista previa; al disparar se arranca desde cero. Una pausa del
  // usuario o un salto con la barra de tiempo sí se respetan al seguir.
  const [armed, setArmed] = useState(true);
  useEffect(() => {
    clock.pause();
    seek(res.tS.t + res.synth.strongDuration * 0.6);
    setSpeed([1, 2, 5, 10, 20].find((k) => res.end / k <= 22) ?? 20);
    setArmed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);
  const toggle = () => {
    if (clock.playing) { clock.pause(); return; }
    if (armed) { seek(0); setArmed(false); }
    clock.play();
  };

  // La URL guarda el escenario (para compartirlo).
  useEffect(() => {
    const id = setTimeout(() => {
      const u = new URL(window.location.href);
      u.search = '';
      if (preset) u.searchParams.set('sismo', preset.id);
      else {
        u.searchParams.set('m', String(p.mag)); u.searchParams.set('h', String(p.depth)); u.searchParams.set('d', String(Math.round(p.dist)));
        u.searchParams.set('amb', p.setting); if (p.setting === 'crustal') u.searchParams.set('mec', p.mech); u.searchParams.set('vs', String(Math.round(p.vs30)));
      }
      window.history.replaceState(window.history.state, '', u);
    }, 400);
    return () => clearTimeout(id);
  }, [p, preset]);

  const { s, rup, sh, tP, tS, surface, synth, end, oor } = res;
  const mmiR = Math.round(sh.mmi), lvl = MMI_SCALE[mmiR - 1];
  const lo = clamp(Math.round(sh.mmi - sh.mmiSigma), 1, 10), hi = clamp(Math.round(sh.mmi + sh.mmiSigma), 1, 10);
  const pgaG = sh.pga.median, pgaLo = pgaG * Math.exp(-sh.pga.sigma), pgaHi = pgaG * Math.exp(sh.pga.sigma);
  const E = energy(d.mag), tn = tnt(E), hiro = E / HIROSHIMA_J;
  const cls = PER_YEAR.find((c) => d.mag >= c.from && d.mag < c.to);
  const siteLabel = preset ? preset.city[lang] : t.you;
  const playLabel = clock.playing ? t.pause : armed ? t.play : clock.shown >= end - 0.05 ? t.replay : t.resume;
  const gfmt = (g: number) => nf(g, g < 0.01 ? 3 : 2);

  return (
    <div className="qs">
      <nav className="ts-switch" aria-label={t.kicker}>
        <span aria-current="page">{t.h1}</span>
        <Link href={routePath(lang, 'tsunamiSim')}>{t.otherSim}</Link>
        <Link href={routePath(lang, 'volcanoSim')}>{VOLC_TEXT[lang].h1}</Link>
      </nav>
      {initial?.title && !preset && <p className="qs-based">{t.basedOn}: <strong>{initial.title}</strong></p>}
      <div className="qs-grid">
        {/* ── Controles ── */}
        <aside className="qs-controls" aria-label={t.quake}>
          <div className="qs-block">
            <h2 className="qs-h">{t.presets}</h2>
            <div className="qs-presets">
              {PRESETS.map((q) => (
                <button key={q.id} type="button" className="qs-chip" aria-pressed={preset?.id === q.id}
                  onClick={() => { setP(fromPreset(q)); setPreset(q); }}>{q.name[lang]}</button>
              ))}
            </div>
            {preset && <p className="qs-note">{preset.note[lang]} <a href={`https://earthquake.usgs.gov/earthquakes/eventpage/${preset.usgs}`} target="_blank" rel="noopener noreferrer">USGS ↗</a>{TSUNAMI_PRESETS.some((x) => x.id === preset.id) && <> · <Link href={`${routePath(lang, 'tsunamiSim')}?tsunami=${preset.id}`}>{t.seeTsunami} →</Link></>}</p>}
          </div>

          <div className="qs-block">
            <h2 className="qs-h">{t.quake}</h2>
            <label className="qs-field">
              <span className="qs-row"><span>{t.mag}</span><b>M {nf(p.mag, 1)}</b></span>
              <input type="range" min={4} max={9.5} step={0.1} value={p.mag} onChange={(e) => set({ mag: +e.target.value })} />
            </label>
            <label className="qs-field">
              <span className="qs-row"><span>{t.depth}</span><b>{nf(p.depth)} km</b></span>
              <input type="range" min={1} max={300} step={1} value={p.depth} onChange={(e) => set({ depth: +e.target.value })} />
            </label>
            <fieldset className="qs-field">
              <legend>{t.setting}</legend>
              <div className="qs-seg" role="radiogroup">
                {(['crustal', 'interface', 'slab'] as Setting[]).map((k) => (
                  <label key={k} className="qs-seg-opt"><input type="radio" name="amb" checked={p.setting === k} onChange={() => set({ setting: k, depth: k === 'slab' && p.depth < 40 ? 60 : k === 'crustal' && p.depth > 25 ? 12 : p.depth })} />{t.settings[k]}</label>
                ))}
              </div>
              <span className="qs-help">{t.settingHelp[p.setting]}</span>
            </fieldset>
            {p.setting === 'crustal' && (
              <fieldset className="qs-field">
                <legend>{t.mech}</legend>
                <div className="qs-seg" role="radiogroup">
                  {(['strike-slip', 'normal', 'reverse'] as Mechanism[]).map((k) => (
                    <label key={k} className="qs-seg-opt"><input type="radio" name="mec" checked={p.mech === k} onChange={() => set({ mech: k })} />{t.mechs[k]}</label>
                  ))}
                </div>
                <span className="qs-help">{t.mechHelp[p.mech]}</span>
              </fieldset>
            )}
          </div>

          <div className="qs-block">
            <h2 className="qs-h">{t.site}</h2>
            <label className="qs-field">
              <span className="qs-row"><span>{t.dist}</span><b>{nf(p.dist)} km</b></span>
              <input type="range" min={0} max={1000} step={1} value={Math.round(logTo(p.dist, ...DIST))} onChange={(e) => set({ dist: Math.round(logFrom(+e.target.value, ...DIST)) })} />
            </label>
            <label className="qs-field">
              <span className="qs-row"><span>{t.soil}</span><b>{nf(p.vs30)} m/s</b></span>
              <input type="range" min={0} max={1000} step={1} value={Math.round(logTo(p.vs30, ...VS))} onChange={(e) => set({ vs30: Math.round(logFrom(+e.target.value, ...VS) / 10) * 10 })} />
              <span className="qs-help"><b>{t.soilClass(p.vs30)}</b>. {t.soilHelp}</span>
            </label>
          </div>
        </aside>

        {/* ── Escena ── */}
        <div className="qs-main">
          <section className="qs-card qs-scene" aria-label={t.section}>
            <div className="qs-card-head">
              <h2 className="qs-h">{t.section}</h2>
              <div className="qs-transport">
                <button type="button" className="qs-play" onClick={toggle}>{playLabel}</button>
                <label className="qs-speed">{t.speed}
                  <select value={clock.speed} onChange={(e) => clock.setSpeed(+e.target.value)}>
                    {[1, 2, 5, 10, 20].map((k) => <option key={k} value={k}>{k}×</option>)}
                  </select>
                </label>
              </div>
            </div>
            <Section lang={lang} clock={clock} depth={d.depth} dist={d.dist} rup={rup} tP={tP} tS={tS} surface={!!surface} siteLabel={siteLabel} />
            <input className="qs-scrub" type="range" min={0} max={end} step={0.05} value={Math.min(clock.shown, end)} aria-label={t.time} onChange={(e) => { clock.pause(); setArmed(false); seek(+e.target.value); }} />
            <div className="qs-legend">
              <span><i style={{ background: `rgb(${P_RGB.join(',')})` }} /><b>{t.waveP}</b> · {t.wavePHelp}</span>
              <span><i style={{ background: `rgb(${S_RGB.join(',')})` }} /><b>{t.waveS}</b> · {t.waveSHelp}</span>
              <span><i className="qs-rup" /><b>{t.rupture}</b></span>
            </div>
            <p className="qs-help">{t.sectionHelp}</p>
          </section>

          <section className="qs-card" aria-label={t.seismogram}>
            <h2 className="qs-h">{t.seismogram}</h2>
            <Seismogram lang={lang} clock={clock} synth={synth} tP={tP.t} tS={tS.t} surface={surface} pga={pgaG} end={end} />
            <div className="qs-arrivals">
              <p><b style={{ color: `rgb(${P_RGB.join(',')})` }}>{t.waveP}</b> {t.arrives} <b>{nf(tP.t, 1)} s</b> · {t.path[tP.path]}</p>
              <p><b style={{ color: `rgb(${S_RGB.join(',')})` }}>{t.waveS}</b> {t.arrives} <b>{nf(tS.t, 1)} s</b> · {t.path[tS.path]}</p>
              <p>{t.spWindow(nf(tS.t - tP.t, 1))}. {d.dist < 150 && t.spRule(nf(8 * (tS.t - tP.t)))} {t.eew}</p>
              {tP.path !== 'direct' && <p className="qs-help">{t.pathHelp[tP.path]}</p>}
              {surface && <p>{t.surfaceArrive(nf(surface.tL, 1), nf(surface.tR, 1))} <span className="qs-help">{t.surfaceHelp}</span></p>}
            </div>
            <p className="qs-help">{t.seismogramHelp}</p>
          </section>
        </div>
      </div>

      {/* ── La cuadra ── */}
      <section className="qs-card" aria-label={t.city}>
        <div className="qs-card-head">
          <h2 className="qs-h">{t.city}</h2>
          <button type="button" className="qs-play" onClick={toggle}>{playLabel}</button>
        </div>
        <City lang={lang} clock={clock} synth={synth} sh={sh} tP={tP.t} tS={tS.t} seed={res.seed} />
        <p className="qs-help">{t.cityHelp}</p>
        <p className="qs-help">{t.cityNote}</p>
      </section>

      {/* ── Resultados ── */}
      <div className="qs-results">
        <section className="qs-card qs-mmi" aria-label={t.intensity}>
          <h2 className="qs-h">{t.intensity}</h2>
          <div className="qs-mmi-top">
            <span className="qs-mmi-badge" style={{ background: lvl.color }}>{ROMAN[mmiR - 1]}</span>
            <div>
              <p className="qs-big">{lvl[lang][0]}</p>
              <p>{t.damage}: <b>{lvl[lang][1]}</b></p>
              <p className="qs-muted">{t.mmiRange(ROMAN[lo - 1], ROMAN[hi - 1])}</p>
            </div>
          </div>
          <div className="qs-mmi-bar" aria-hidden="true">
            {MMI_SCALE.map((m) => <span key={m.mmi} style={{ background: m.color }}>{ROMAN[m.mmi - 1]}</span>)}
            <i className="qs-mmi-range" style={{ left: `${(lo - 1) * 10}%`, width: `${(hi - lo + 1) * 10}%` }} />
            <i className="qs-mmi-mark" style={{ left: `${((sh.mmi - 0.5) * 10).toFixed(1)}%` }} />
          </div>
          <p>{MMI_TEXT[lang][mmiR - 1]}</p>
          <dl className="qs-dl">
            <div><dt>{t.pga}</dt><dd>{gfmt(pgaG)} g <span className="qs-muted">({nf(pgaG * 100, pgaG < 0.1 ? 1 : 0)} % {t.ofG}, {nf(pgaG * G_CMS2)} cm/s²)</span><br /><span className="qs-muted">±1σ: {gfmt(pgaLo)}–{gfmt(pgaHi)} g</span></dd></div>
            {sh.pgv && <div><dt>{t.pgv}</dt><dd>{nf(sh.pgv.median, sh.pgv.median < 10 ? 1 : 0)} cm/s</dd></div>}
            <div><dt>{t.model}</dt><dd>{modelFor(s)} · {sh.mmiFrom === 'pgv' ? t.mmiFromPgv : t.mmiFromPga}</dd></div>
          </dl>
          {oor.length > 0 && <p className="qs-warn">{t.outOfRange} ({oor.map((k) => t.oor[k as keyof typeof t.oor]).join(', ')})</p>}
        </section>


        <section className="qs-card" aria-label={t.ruptureTitle}>
          <h2 className="qs-h">{t.ruptureTitle}</h2>
          <RuptureBox lang={lang} length={rup.length} width={rup.width} />
          <dl className="qs-dl">
            <div><dt>{t.length} × {t.width}</dt><dd>{nf(rup.length)} × {nf(rup.width)} km</dd></div>
            <div><dt>{t.slip}</dt><dd>{nf(rup.slip, rup.slip < 1 ? 2 : 1)} m</dd></div>
            <div><dt>{t.duration}</dt><dd>≈ {nf(rup.duration)} s</dd></div>
          </dl>
          {rup.clipped && <p className="qs-help">{t.clipped}</p>}
          <p className="qs-help">{t.ruptureHelp}</p>
        </section>

        <section className="qs-card" aria-label={t.energy}>
          <h2 className="qs-h">{t.energy}</h2>
          <p className="qs-big">{sci(lang, E)} J</p>
          <p>{t.tntEq} <b>{nf(tn.value, tn.value < 10 ? 1 : 0)} {t.tnt[tn.unit]}</b>{' · '}{hiro >= 1 ? t.hiroshima(nf(hiro, hiro < 10 ? 1 : 0)) : t.hiroshimaLess(`${nf(hiro * 100, hiro < 0.01 ? 2 : 0)} %`)}</p>
          <EnergyScale lang={lang} mag={d.mag} />
          <p className="qs-help">{t.perStep}</p>
          {cls && <p><b>{t.perYear}</b>: {t.perYearN(nf(cls.n, cls.n < 10 ? 1 : 0), cls.to >= 10 ? `M${cls.from}+` : `M${cls.from}–${cls.to - 0.1}`)}. <span className="qs-muted">{t.perYearSrc}</span></p>}
        </section>
        <section className="qs-card qs-wide" aria-label={t.buildings}>
          <h2 className="qs-h">{t.buildings}</h2>
          <div className="qs-bld-grid">
            <Buildings lang={lang} clock={clock} synth={synth} />
            <div>
              <h3 className="qs-h3">{t.spectrum}</h3>
              <Spectrum lang={lang} spectrum={sh.spectrum} marks={FLOORS.map((f) => ({ T: periodOf(f), label: String(f) }))} />
              <p className="qs-help">{t.spectrumHelp}</p>
            </div>
          </div>
          <p className="qs-help">{t.buildingsHelp}</p>
        </section>

        {preset && (
          <section className="qs-card qs-wide" aria-label={t.obsTitle}>
            <h2 className="qs-h">{t.obsTitle}</h2>
            <p className="qs-note">{t.obsIntro}</p>
            <Observed lang={lang} preset={preset} mag={d.mag} depth={d.depth} setting={d.setting} mech={d.setting === 'crustal' ? d.mech : 'reverse'} vs30={d.vs30} />
          </section>
        )}

        <section className="qs-card qs-wide" aria-label={t.particles}>
          <h2 className="qs-h">{t.particles}</h2>
          <Particles lang={lang} />
          <p className="qs-help">{t.particlesHelp}</p>
        </section>
      </div>

      <section className="qs-how ed-prose">
        <section>
          <h2>{t.how}</h2>
          <dl className="qs-how-list">
            {t.howItems.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
        <section>
          <h2>{t.limits}</h2>
          <p>{t.limitsText}</p>
        </section>
        <section>
          <h2>{t.sources}</h2>
          <ul className="ed-list">
            {SIM_SOURCES.map((src) => <li key={src.url}><a href={src.url} target="_blank" rel="noopener noreferrer">{src.label} ↗</a></li>)}
          </ul>
          <p className="qs-help">{t.csvNote}</p>
        </section>
      </section>
    </div>
  );
}

/** Rectángulo de la ruptura a escala, con una barra de 100 km. */
function RuptureBox({ lang, length, width }: { lang: Lang; length: number; width: number }) {
  // Coordenadas redondeadas (el servidor y el navegador difieren en los últimos decimales).
  const W = 300, H = 90, k = Math.round(Math.min((W - 70) / Math.max(length, 100), (H - 26) / width) * 1e4) / 1e4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="qs-rupbox" aria-hidden="true">
      <rect x={10} y={8} width={length * k} height={width * k} fill="rgba(200,16,46,.18)" stroke="#c8102e" strokeWidth={1.5} />
      <line x1={10} x2={10 + 100 * k} y1={H - 8} y2={H - 8} stroke="#141414" strokeWidth={2} />
      <text x={14 + 100 * k} y={H - 8} dominantBaseline="middle" className="qs-axis">{fmtNum(lang, 100)} km</text>
    </svg>
  );
}

/** Escala logarítmica de energía con sismos de referencia. */
function EnergyScale({ lang, mag }: { lang: Lang; mag: number }) {
  const refs = [[5, 'M5'], [6, 'M6'], [7, 'M7'], [8, 'M8'], [9, 'M9'], [9.5, '1960']] as const;
  const X = (m: number) => Math.round((6 + ((m - 4) / 5.6) * 270) * 10) / 10;
  return (
    <svg viewBox="0 0 300 46" className="qs-escale" role="img" aria-label={`M ${fmtNum(lang, mag, 1)}`}>
      <line x1={6} x2={X(9.6)} y1={20} y2={20} stroke="#e7e7e2" strokeWidth={8} strokeLinecap="round" />
      <line x1={6} x2={X(mag)} y1={20} y2={20} stroke="#e8590c" strokeWidth={8} strokeLinecap="round" />
      {refs.map(([m, l]) => (
        <g key={l}>
          <line x1={X(m)} x2={X(m)} y1={12} y2={28} stroke="#141414" strokeWidth={1} />
          <text x={X(m)} y={40} textAnchor="middle" className="qs-axis">{l}</text>
        </g>
      ))}
    </svg>
  );
}
