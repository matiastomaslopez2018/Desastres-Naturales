'use client';
/*
 * Llegada a la costa: serie de tiempo simulada frente a la costa (celda de agua más cercana), estimación en
 * la orilla por la ley de Green, lo medido por la NOAA cerca y una escena animada de una costa baja.
 */
import { useEffect, useMemo, useRef } from 'react';
import { km, shoreSeries } from '@/lib/tsunami/analysis';
import { TSU_TEXT } from '@/lib/tsunami/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { prep, useCanvasSize, type Clock } from '../quake/clock';
import { drawBeach } from './beach';

type Props = {
  lang: Lang; clock: Clock; site: { name: string; lon: number; lat: number };
  series: Float32Array; seriesDt: number; depth: number; hours: number;
  /** Distancia (km) del punto de agua simulado a la orilla, y movimiento vertical de la costa en el sismo (m). */
  distKm: number; land: number;
  runups: number[][];
};

export function Coast({ lang, clock, site, series, seriesDt, depth, hours, runups, distKm, land }: Props) {
  const t = TSU_TEXT[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const { now, subscribe } = clock;
  // Nivel en la orilla, relativo a la costa: la ola del punto simulado, amplificada por la ley de Green y
  // demorada lo que tarda en cruzar la plataforma (a la velocidad media √(g·h/2) de una pendiente uniforme),
  // menos el movimiento vertical de la propia costa en el sismo (si la costa se hunde, el mar sube enseguida).
  const shore = useMemo(() => shoreSeries(series, seriesDt, depth, distKm, land).shore, [series, seriesDt, depth, distKm, land]);
  const info = useMemo(() => {
    let first = -1, sign = 0, max = 0, maxAt = 0, min = 0;
    for (let i = 0; i < shore.length; i++) {
      const v = shore[i], wave = v + land;
      if (first < 0 && Math.abs(wave) >= 0.05) { first = i; sign = Math.sign(wave); }
      if (v > max) { max = v; maxAt = i; }
      if (v < min) min = v;
    }
    const near = runups.filter((r) => km([r[0], r[1]], [site.lon, site.lat]) <= 50).map((r) => r[2]).sort((a, b) => a - b);
    return { first: first >= 0 ? first * seriesDt : null, sign, max, min, maxAt: maxAt * seriesDt, near };
  }, [shore, land, seriesDt, runups, site]);
  const fmtT = (s: number) => `${Math.floor(s / 3600)} ${t.h} ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} ${t.min}`;

  // Gráfico de la serie, con el cursor de tiempo.
  const gw = useRef<HTMLDivElement>(null), gc = useRef<HTMLCanvasElement>(null);
  const gs = useCanvasSize(gw);
  // Escena de la costa.
  const sw = useRef<HTMLDivElement>(null), sc = useRef<HTMLCanvasElement>(null);
  const ss = useCanvasSize(sw);
  // Escala vertical: la mayor subida o bajada del mar estimada en la orilla.
  const yMax = Math.max(3, info.max * 1.25, -info.min * 1.25);

  useEffect(() => {
    const canvas = gc.current, scene = sc.current;
    if (!canvas || !scene || !gs.w || !ss.w) return;
    const at = (time: number) => { const i = Math.min(series.length - 1, Math.max(0, time / seriesDt)); const a = Math.floor(i), b = Math.min(series.length - 1, a + 1); return shore[a] * (1 - (i - a)) + shore[b] * (i - a); };
    const drawChart = (time: number) => {
      const ctx = prep(canvas, gs.w, gs.h, gs.dpr);
      if (!ctx) return;
      const L = 40, R = 8, T = 10, B = 22, pw = gs.w - L - R, ph = gs.h - T - B;
      const X = (s: number) => L + (s / (hours * 3600)) * pw, Y = (v: number) => T + ph / 2 - (v / yMax) * (ph / 2);
      ctx.font = '11px var(--font-isans), system-ui, sans-serif'; ctx.fillStyle = '#6f6f6b'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const v of [-yMax, 0, yMax]) { ctx.fillText(`${fmtNum(lang, v, yMax < 10 ? 1 : 0)} m`, L - 4, Y(v)); ctx.fillStyle = '#e7e7e2'; ctx.fillRect(L, Y(v), pw, 1); ctx.fillStyle = '#6f6f6b'; }
      ctx.textAlign = 'center';
      for (let hh = 0; hh <= hours; hh += hours > 12 ? 4 : 2) ctx.fillText(`${hh} ${t.h}`, X(hh * 3600), gs.h - 8);
      const trace = (arr: Float32Array, col: string, lw: number) => {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
        for (let i = 0; i < arr.length; i += 2) { const x = X(i * seriesDt), y = Y(Math.max(-yMax, Math.min(yMax, arr[i]))); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      };
      trace(series, 'rgba(28,110,214,.55)', 1);
      trace(shore, '#141414', 1.4);
      ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(time), T); ctx.lineTo(X(time), T + ph); ctx.stroke();
    };
    const drawScene = (time: number) => {
      const ctx = prep(scene, ss.w, ss.h, ss.dpr);
      if (!ctx) return;
      const level = at(time);
      drawBeach(ctx, ss.w, ss.h, level, yMax, time, `${level >= 0 ? '+' : '−'}${fmtNum(lang, Math.abs(level), 1)} m · ${fmtT(time)}`);
    };
    const draw = (time: number) => { drawChart(time); drawScene(time); };
    draw(now());
    return subscribe(draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.w, gs.h, gs.dpr, ss.w, ss.h, ss.dpr, now, subscribe, series, shore, seriesDt, hours, yMax, lang]);

  const nearMax = info.near.length ? info.near[info.near.length - 1] : null, nearMed = info.near.length ? info.near[Math.floor(info.near.length / 2)] : null;
  return (
    <div className="ts-coast">
      <div className="ts-coast-facts">
        <p className="qs-big">{site.name}</p>
        {info.first != null ? <p>{t.coastArrive(fmtT(info.first))} · <b>{info.sign > 0 ? t.firstUp : t.firstDown}</b></p> : <p className="qs-muted">—</p>}
        <p>{t.coastMax(nf(info.max, info.max < 10 ? 1 : 0))}</p>
        <p className="qs-muted">{nearMax != null ? t.coastObs(nf(nearMed!, 1), nf(nearMax, 1), info.near.length) : t.coastNoObs}</p>
      </div>
      <div ref={gw} className="ts-coast-chart"><canvas ref={gc} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" /></div>
      <p className="qs-legend"><span><i style={{ background: 'rgba(28,110,214,.55)' }} />{t.coastAt(nf(depth))}</span><span><i style={{ background: '#141414' }} />{t.coastShore}</span></p>
      <h3 className="qs-h3">{t.scene}</h3>
      <div ref={sw} className="ts-coast-scene"><canvas ref={sc} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" /></div>
      <p className="qs-help">{t.sceneHelp}</p>
    </div>
  );
}
