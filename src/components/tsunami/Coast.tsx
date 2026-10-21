'use client';
/*
 * Llegada a la costa: serie de tiempo simulada frente a la costa (celda de agua más cercana), estimación en
 * la orilla por la ley de Green, lo medido por la NOAA cerca y una escena animada de una costa baja.
 */
import { useEffect, useMemo, useRef } from 'react';
import { greensFactor, km } from '@/lib/tsunami/analysis';
import { TSU_TEXT } from '@/lib/tsunami/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { prep, useCanvasSize, type Clock } from '../quake/clock';

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
  const k = greensFactor(depth, 1);
  // Nivel en la orilla, relativo a la costa: la ola del punto simulado, amplificada por la ley de Green y
  // demorada lo que tarda en cruzar la plataforma (a la velocidad media √(g·h/2) de una pendiente uniforme),
  // menos el movimiento vertical de la propia costa en el sismo (si la costa se hunde, el mar sube enseguida).
  const delay = (distKm * 1e3) / Math.sqrt((9.81 * depth) / 2);
  const shore = useMemo(() => {
    const out = new Float32Array(series.length);
    for (let i = 0; i < series.length; i++) {
      const j = i - delay / seriesDt, a = Math.floor(j);
      const wave = j < 0 ? 0 : a + 1 < series.length ? series[a] * (1 - (j - a)) + series[a + 1] * (j - a) : series[series.length - 1];
      out[i] = k * wave - land;
    }
    return out;
  }, [series, seriesDt, delay, k, land]);
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
    // Escena: perfil de costa baja; alturas reales, ancho comprimido. Agua plana al nivel estimado en la orilla.
    const r0 = (n: number) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const houses = Array.from({ length: 7 }, (_, i) => ({ x: 0.18 + i * 0.11 + r0(i) * 0.03, w: 0.045 + r0(i + 9) * 0.02, hh: 3 + r0(i + 3) * (i % 3 === 0 ? 6 : 2.5), concrete: i % 3 === 0 }));
    const drawScene = (time: number) => {
      const ctx = prep(scene, ss.w, ss.h, ss.dpr);
      if (!ctx) return;
      const W = ss.w, H = ss.h, top = Math.max(yMax, 12) + 4, bottom = -Math.max(4, yMax * 0.5);
      const Y = (m: number) => ((top - m) / (top - bottom)) * H;
      // Terreno: mar a la izquierda (fondo con pendiente 1:50), orilla en x = 0,32·W, tierra con pendiente 1:100 (comprimida).
      const shoreX = 0.32 * W;
      const ground = (x: number) => (x < shoreX ? -((shoreX - x) / shoreX) * (-bottom) * 0.9 : ((x - shoreX) / (W - shoreX)) * Math.min(top - 2, 30));
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#cfe3f0'); sky.addColorStop(1, '#eef3f4');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      const level = at(time);
      // Agua: hasta donde el terreno queda por debajo del nivel.
      ctx.fillStyle = 'rgba(46,112,160,.85)';
      ctx.beginPath(); ctx.moveTo(0, H);
      let xEnd = 0;
      for (let x = 0; x <= W; x += 2) { if (ground(x) < level) xEnd = x; else break; }
      for (let x = 0; x <= xEnd; x += 2) ctx.lineTo(x, Y(level) + Math.sin(x * 0.05 - time * 0.02) * 1.2);
      ctx.lineTo(xEnd, H); ctx.closePath(); ctx.fill();
      // Espuma en el frente cuando el agua avanza sobre tierra.
      if (level > 0.2 && xEnd > shoreX) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(xEnd, Y(level), 6, 3, 0, 0, Math.PI * 2); ctx.fill(); }
      // Terreno.
      ctx.fillStyle = '#c9b48d'; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 2) ctx.lineTo(x, Y(ground(x)));
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      // Casas (madera bajas y algunas de hormigón más altas) con la marca de agua.
      for (const hs of houses) {
        const x = hs.x * W + shoreX * 0.4, g = ground(x), wpx = hs.w * W;
        ctx.fillStyle = hs.concrete ? '#b8b8b2' : '#d9c8a4';
        ctx.fillRect(x, Y(g + hs.hh), wpx, Y(g) - Y(g + hs.hh));
        ctx.fillStyle = hs.concrete ? '#8f8f8a' : '#9c4a2f';
        if (!hs.concrete) { ctx.beginPath(); ctx.moveTo(x - 2, Y(g + hs.hh)); ctx.lineTo(x + wpx / 2, Y(g + hs.hh + 1.6)); ctx.lineTo(x + wpx + 2, Y(g + hs.hh)); ctx.closePath(); ctx.fill(); }
        const depthW = level - g;
        if (depthW > 0) { ctx.fillStyle = 'rgba(46,112,160,.55)'; ctx.fillRect(x, Y(Math.min(level, g + hs.hh)), wpx, Y(g) - Y(Math.min(level, g + hs.hh))); }
      }
      // Rótulo con el nivel.
      ctx.font = '600 13px var(--font-isans), system-ui, sans-serif'; ctx.fillStyle = '#141414'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`${level >= 0 ? '+' : '−'}${fmtNum(lang, Math.abs(level), 1)} m · ${fmtT(time)}`, 10, 8);
      ctx.strokeStyle = 'rgba(20,20,20,.35)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke(); ctx.setLineDash([]);
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
