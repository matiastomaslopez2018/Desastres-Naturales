'use client';
/* Simulador de tsunamis: controles, mapa del océano, fuente, llegada a la costa y comparación con lo observado. */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { TSUNAMI_PRESETS, type TsunamiPreset } from '@/lib/tsunami/presets';
import { cropGrid, MIN_DEPTH, type Grid } from '@/lib/tsunami/swe';
import { cellAt, compare, km, type Gauge } from '@/lib/tsunami/analysis';
import { dzAt, prepare } from '@/lib/tsunami/okada';
import { toSubfault } from '@/lib/tsunami/source';
import type { FaultRow } from '@/lib/tsunami/source';
import { TSU_SOURCES, TSU_TEXT } from '@/lib/tsunami/text';
import { VOLC_TEXT } from '@/lib/volcano/text';
import { routePath } from '@/lib/seo';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { useClock } from '../quake/clock';
import { OceanMap } from './OceanMap';
import { SourcePanel } from './SourcePanel';
import { Validation } from './Validation';
import { Coast } from './Coast';
import type { WorkerIn, WorkerOut } from './tsunami.worker';

type Global = { z: Int16Array; nx: number; ny: number; lon0: number; lat0: number; step: number };
type EventData = { id: string; usgs: string; source: 'usgs-ffm' | 'uniform'; faults: FaultRow[]; gauges: Gauge[]; runups: number[][] };
type Result = Extract<WorkerOut, { type: 'done' }>;

const HOURS = 26;
const SPEEDS = [600, 1200, 2400, 4800];

/** Batimetría global (una sola vez). El archivo viene comprimido con gzip; si el servidor ya lo descomprimió, se usa tal cual. */
let globalPromise: Promise<Global> | null = null;
function loadGlobal(): Promise<Global> {
  globalPromise ??= (async () => {
    const [meta, buf] = await Promise.all([
      fetch('/data/tsunami/etopo1-15m.json').then((r) => r.json()),
      fetch('/data/tsunami/etopo1-15m.bin.gz').then((r) => r.arrayBuffer()),
    ]);
    const u8 = new Uint8Array(buf);
    let raw: ArrayBuffer = buf;
    if (u8[0] === 0x1f && u8[1] === 0x8b) raw = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return { z: new Int16Array(raw), nx: meta.nx, ny: meta.ny, lon0: meta.lon0, lat0: meta.lat0, step: meta.step };
  })();
  return globalPromise;
}

export function TsunamiSim({ lang, initial }: { lang: Lang; initial?: string }) {
  const t = TSU_TEXT[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const [preset, setPreset] = useState<TsunamiPreset>(() => TSUNAMI_PRESETS.find((p) => p.id === initial) ?? TSUNAMI_PRESETS[0]);
  const [dMag, setDMag] = useState(0);
  const [hi, setHi] = useState(false);
  const [site, setSite] = useState(0);
  const [global, setGlobal] = useState<Global | null>(null);
  const [data, setData] = useState<EventData | null>(null);
  const [progress, setProgress] = useState(0);
  const [res, setRes] = useState<{ key: string; r: Result } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => { loadGlobal().then(setGlobal).catch(() => setGlobal(null)); }, []);
  useEffect(() => {
    let alive = true;
    setData(null);
    fetch(`/data/tsunami/${preset.id}.json`).then((r) => r.json()).then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [preset.id]);

  // Grilla de la cuenca y celdas de agua.
  const grid: Grid | null = useMemo(() => (global ? cropGrid(global, preset.box, hi ? 1 : 2) : null), [global, preset.box, hi]);
  const wet = useMemo(() => { if (!grid) return null; const w = new Uint8Array(grid.nx * grid.ny); grid.h.forEach((v, k) => { w[k] = v >= MIN_DEPTH ? 1 : 0; }); return w; }, [grid]);
  // Puntos de costa: la celda de agua de al menos 100 m más cercana a cada lugar. Más cerca de la orilla, una
  // celda de 25–50 km no representa el asomeramiento; desde ahí se estima la orilla con la ley de Green.
  const probes = useMemo(() => (grid && wet ? preset.coast.map((c) => cellAt(grid, wet, preset.box, c.lon, c.lat, hi ? 12 : 6, 100)) : []), [grid, wet, preset, hi]);

  // Para cada lugar de la costa: distancia del punto simulado a la orilla y movimiento vertical de la costa (Okada).
  const coastGeo = useMemo(() => {
    if (!grid || !data) return [];
    const s = 10 ** (1.5 * dMag), ps = data.faults.filter((f) => f[8] > 0.01).map((f) => prepare(toSubfault([...f.slice(0, 8), f[8] * s], (x) => x)));
    return preset.coast.map((c, i) => {
      const k = probes[i];
      if (k < 0) return { distKm: 0, land: 0 };
      const plon = grid.lon0 + (k % grid.nx) * grid.step, plat = grid.lat0 + Math.floor(k / grid.nx) * grid.step;
      let land = 0;
      for (const P of ps) land += dzAt(P, c.lon, c.lat);
      return { distKm: km([plon, plat], [c.lon, c.lat]), land: Math.abs(land) < 0.01 ? 0 : land };
    });
  }, [grid, data, preset, probes, dMag]);

  // Simulación en un Web Worker; se relanza cuando cambia el escenario.
  const key = `${preset.id}|${dMag}|${hi}`;
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => {
    if (!grid || !data || data.id !== preset.id) return;
    workerRef.current?.terminate();
    const w = new Worker(new URL('./tsunami.worker.ts', import.meta.url));
    workerRef.current = w;
    setProgress(0); setFailed(false);
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      if (e.data.type === 'progress') setProgress(e.data.t / (e.data.hours * 3600));
      else { setRes({ key, r: e.data }); setProgress(1); w.terminate(); }
    };
    w.onerror = (e) => { console.error('tsunami worker', e.message); setFailed(true); };
    const msg: WorkerIn = { grid, faults: data.faults, slipScale: 10 ** (1.5 * dMag), hours: HOURS, probes };
    w.postMessage(msg);
    return () => w.terminate();
  }, [grid, data, preset.id, dMag, probes, key]);

  // Mediciones cerca de la costa: relevamientos en tierra y alturas en mareógrafos.
  const coastObs = useMemo(() => (data ? [...data.runups, ...data.gauges.filter((g) => g[4] === 2 && g[3] > 0).map((g) => [g[0], g[1], g[3]])] : []), [data]);
  const r = res?.key === key ? res.r : null;
  const clock = useClock(HOURS * 3600);
  const { seek, setSpeed } = clock;
  const [armed, setArmed] = useState(true);
  useEffect(() => {
    clock.pause(); seek(0); setSpeed(2400); setArmed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const toggle = () => { if (clock.playing) { clock.pause(); return; } if (armed) { seek(0); setArmed(false); } clock.play(); };
  const playLabel = clock.playing ? t.pause : armed ? t.play : clock.shown >= clock.end - 1 ? t.replay : t.resume;

  const cmp = useMemo(() => (r && grid && wet && data ? compare(grid, wet, preset.box, r.arrival, r.maxEta, data.gauges) : null), [r, grid, wet, data, preset.box]);
  const epi = useMemo<[number, number]>(() => {
    if (!data) return [0, 0];
    // Centro del deslizamiento (ponderado), como referencia en el mapa.
    let sw = 0, x = 0, y = 0;
    for (const f of data.faults) { sw += f[8]; x += f[8] * f[0]; y += f[8] * f[1]; }
    return [x / sw, y / sw];
  }, [data]);

  return (
    <div className="qs ts">
      <nav className="ts-switch" aria-label={t.kicker}>
        <Link href={routePath(lang, 'simulator')}>{t.otherSim}</Link>
        <span aria-current="page">{t.h1}</span>
        <Link href={routePath(lang, 'volcanoSim')}>{VOLC_TEXT[lang].h1}</Link>
      </nav>
      <div className="qs-grid">
        <aside className="qs-controls" aria-label={t.presets}>
          <div className="qs-block">
            <h2 className="qs-h">{t.presets}</h2>
            <div className="qs-presets">
              {TSUNAMI_PRESETS.map((p) => (
                <button key={p.id} type="button" className="qs-chip" aria-pressed={p.id === preset.id} onClick={() => { setPreset(p); setDMag(0); setSite(0); }}>{p.name[lang]}</button>
              ))}
            </div>
            <p className="qs-note">{preset.note[lang]} <a href={`https://earthquake.usgs.gov/earthquakes/eventpage/${preset.usgs}`} target="_blank" rel="noopener noreferrer">USGS ↗</a></p>
          </div>
          <div className="qs-block">
            <h2 className="qs-h">{t.size}</h2>
            <label className="qs-field">
              <span className="qs-row"><span>{t.magDelta}</span><b>M {nf(preset.mag + dMag, 1)}</b></span>
              <input type="range" min={-0.5} max={0.5} step={0.1} value={dMag} onChange={(e) => setDMag(Math.round(+e.target.value * 10) / 10)} />
              <span className="qs-help">{t.magHelp}</span>
            </label>
            <fieldset className="qs-field">
              <legend>{t.resolution}</legend>
              <div className="qs-seg ts-seg2" role="radiogroup">
                <label className="qs-seg-opt"><input type="radio" name="res" checked={!hi} onChange={() => setHi(false)} />{t.resLow}</label>
                <label className="qs-seg-opt"><input type="radio" name="res" checked={hi} onChange={() => setHi(true)} />{t.resHigh}</label>
              </div>
            </fieldset>
            <p className="qs-help" aria-live="polite">{failed ? t.failed : r ? t.runDone(nf(r.ms / 1000, 1), String(HOURS)) : `${t.run} ${nf(progress * 100)} %`}</p>
          </div>
        </aside>

        <div className="qs-main">
          <section className="qs-card" aria-label={t.ocean}>
            <div className="qs-card-head">
              <h2 className="qs-h">{t.ocean}</h2>
              <div className="qs-transport">
                <button type="button" className="qs-play" onClick={toggle} disabled={!r}>{playLabel}</button>
                <label className="qs-speed">{t.speed}
                  <select value={clock.speed} onChange={(e) => clock.setSpeed(+e.target.value)}>
                    {SPEEDS.map((k) => <option key={k} value={k}>{nf(k)}×</option>)}
                  </select>
                </label>
              </div>
            </div>
            {grid && wet && data ? (
              <OceanMap lang={lang} clock={clock} grid={grid} wet={wet} box={preset.box} frames={r?.frames ?? null} frameS={r?.frameS ?? 600} amp={r?.amp ?? 1.5}
                arrival={r?.arrival ?? null} gauges={data.gauges} sites={preset.coast} epi={epi} />
            ) : <div className="ts-map ts-loading">{t.run}</div>}
            <input className="qs-scrub" type="range" min={0} max={HOURS * 3600} step={60} value={clock.shown} aria-label={t.time} onChange={(e) => { clock.pause(); setArmed(false); seek(+e.target.value); }} />
            <div className="qs-legend">
              <span><i style={{ background: '#d62839' }} />{t.legendUp}</span>
              <span><i style={{ background: '#1c6ed6' }} />{t.legendDown}</span>
              <span><i style={{ background: '#2a3f52', height: 2 }} />{t.contours}</span>
              <span>● {t.gauge}</span><span>◆ {t.dart}</span>
            </div>
            <p className="qs-help">{t.oceanHelp}</p>
          </section>
        </div>
      </div>

      {r && grid && wet && data && (
        <>
          <section className="qs-card" aria-label={t.coast}>
            <div className="qs-card-head">
              <h2 className="qs-h">{t.coast}</h2>
              <div className="qs-presets">
                {preset.coast.map((c, i) => <button key={c.name} type="button" className="qs-chip" aria-pressed={i === site} onClick={() => setSite(i)}>{c.name}</button>)}
              </div>
            </div>
            {probes[site] >= 0 && r.series[site] ? (
              <Coast lang={lang} clock={clock} site={preset.coast[site]} series={r.series[site]} seriesDt={r.seriesDt} depth={grid.h[probes[site]]} hours={HOURS} runups={coastObs} distKm={coastGeo[site]?.distKm ?? 0} land={coastGeo[site]?.land ?? 0} />
            ) : <p className="qs-note">—</p>}
            <p className="qs-help">{t.coastHelp}</p>
          </section>

          <section className="qs-card" aria-label={t.source}>
            <h2 className="qs-h">{t.source}</h2>
            <SourcePanel lang={lang} faults={data.faults} slipScale={10 ** (1.5 * dMag)} fine={r.fine} global={global!} box={preset.box} uniform={data.source === 'uniform'} />
            <p className="qs-help">{t.sourceHelp}</p>
          </section>

          {cmp && dMag === 0 && (
            <section className="qs-card" aria-label={t.check}>
              <h2 className="qs-h">{t.check}</h2>
              <p className="qs-note">{t.checkHelp}</p>
              <Validation lang={lang} cmp={cmp} />
            </section>
          )}
        </>
      )}

      <section className="qs-how ed-prose">
        <section>
          <h2>{t.how}</h2>
          <dl className="qs-how-list">{t.howItems.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </section>
        <section><h2>{t.limits}</h2><p>{t.limitsText}</p></section>
        <section>
          <h2>{t.sources}</h2>
          <ul className="ed-list">{TSU_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a></li>)}</ul>
        </section>
      </section>
    </div>
  );
}
