'use client';
/*
 * Sismograma real de un sismo (/api/seismogram): la componente vertical de la estación abierta más cercana, con
 * las llegadas P, S y superficiales calculadas, y un botón para escucharlo acelerado (las vibraciones del suelo son
 * demasiado lentas para el oído: al reproducirlas N veces más rápido, sus frecuencias suben a la banda audible).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { prep, useCanvasSize } from './clock';

type Seis = { net: string; sta: string; site: string; distKm: number; start: number; sps: number; peak: number; data: string; p: number; s: number; surface: number | null };

const NET: Record<string, string> = {
  IU: 'Global Seismographic Network (IRIS/USGS)', II: 'Global Seismographic Network (IRIS/IDA)', G: 'GEOSCOPE (IPGP/EOST)', GT: 'Global Telemetered Seismograph Network (USGS)',
  CU: 'Caribbean Network (USGS)', IC: 'New China Digital Seismograph Network', US: 'United States National Seismic Network (USGS)', C1: 'Red Sismológica Nacional de Chile (CSN)',
};

const T = {
  es: {
    title: 'El sismograma real', loading: 'Buscando el registro de una estación cercana…', none: 'Todavía no hay un registro disponible de una estación abierta cercana (las estaciones publican sus datos con algunos minutos de demora, y no todas las zonas tienen una cerca).',
    station: (s: string, km: string) => `Estación ${s}, a ${km} km del epicentro`, axis: 'segundos desde el sismo', peak: (v: string) => `Velocidad máxima del suelo en la estación: ${v}`,
    p: 'P', s: 'S', surf: 'Superficiales',
    play: (x: string) => `▶ Escucharlo (acelerado ${x} veces)`, stop: '■ Detener',
    text: 'Así lo registró el sensor vertical de un sismógrafo. Primero llega la onda P, de compresión, la más rápida; después la S, que sacude de lado a lado y suele ser más fuerte; y en los sismos poco profundos, las ondas superficiales, las más lentas y largas. Las marcas son las llegadas calculadas con el modelo de la Tierra ak135. Para escucharlo, la grabación se acelera: así las vibraciones, demasiado lentas para el oído, se vuelven sonido.',
    credit: 'Datos: EarthScope Consortium (servicios FDSN)', net: 'Red', units: { um: 'µm/s', mm: 'mm/s' },
  },
  en: {
    title: 'The real seismogram', loading: 'Looking for a nearby station’s recording…', none: 'No recording from an open nearby station is available yet (stations publish their data with a few minutes’ delay, and not every region has one nearby).',
    station: (s: string, km: string) => `Station ${s}, ${km} km from the epicentre`, axis: 'seconds after the earthquake', peak: (v: string) => `Peak ground velocity at the station: ${v}`,
    p: 'P', s: 'S', surf: 'Surface',
    play: (x: string) => `▶ Listen (sped up ${x} times)`, stop: '■ Stop',
    text: 'This is how the vertical sensor of a seismograph recorded it. First comes the P wave, a compression wave and the fastest; then the S wave, which shakes side to side and is usually stronger; and in shallow earthquakes, the surface waves, the slowest and longest. The marks are the arrivals computed with the ak135 Earth model. To hear it, the recording is sped up: that turns vibrations too slow for the ear into sound.',
    credit: 'Data: EarthScope Consortium (FDSN services)', net: 'Network', units: { um: 'µm/s', mm: 'mm/s' },
  },
};

const AUDIO_RATE = 8000;

export function RealSeismogram({ lang, id, time }: { lang: Lang; id: string; time: number }) {
  const t = T[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const [seis, setSeis] = useState<Seis | null | 'loading'>('loading');
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);
  const [playing, setPlaying] = useState(false);
  const [head, setHead] = useState<number | null>(null);
  const audio = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode } | null>(null);

  useEffect(() => {
    let ok = true;
    fetch(`/api/seismogram?id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { seismogram: Seis | null }) => { if (ok) setSeis(j.seismogram); }).catch(() => { if (ok) setSeis(null); });
    return () => { ok = false; };
  }, [id]);

  // Muestras normalizadas (Int16 little-endian en base64 → −1…1).
  const y = useMemo(() => {
    if (!seis || seis === 'loading') return null;
    const bin = atob(seis.data), out = new Float32Array(bin.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = (((bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16) >> 16) / 32767;
    return out;
  }, [seis]);
  const s = seis && seis !== 'loading' ? seis : null;
  const t0 = s ? (s.start - time) / 1000 : 0, dur = s && y ? y.length / s.sps : 0;
  // Aceleración: que se escuche en unos 8 segundos (al menos 40 veces, para que suene).
  const speed = Math.max(40, Math.round(dur / 8 / 10) * 10);

  useEffect(() => {
    const ctx = prep(cv.current, w, h, dpr);
    if (!ctx || !s || !y) return;
    const padL = 8, padB = 22, W = w - 2 * padL, H = h - padB - 18, mid = 18 + H / 2;
    const X = (sec: number) => padL + ((sec - t0) / dur) * W;
    // Mínimo y máximo por columna de píxeles.
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 1; ctx.beginPath();
    const per = y.length / W;
    for (let c = 0; c < W; c++) {
      let lo = 1, hi = -1;
      for (let i = Math.floor(c * per); i < Math.min(y.length, Math.floor((c + 1) * per) + 1); i++) { if (y[i] < lo) lo = y[i]; if (y[i] > hi) hi = y[i]; }
      ctx.moveTo(padL + c + 0.5, mid - hi * (H / 2)); ctx.lineTo(padL + c + 0.5, mid - lo * (H / 2) + 0.5);
    }
    ctx.stroke();
    // Llegadas.
    ctx.font = '600 11px var(--font-isans), system-ui, sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    for (const [sec, label, color] of [[s.p, t.p, '#1c7ed6'], [s.s, t.s, '#e03131'], ...(s.surface != null ? [[s.surface, t.surf, '#2f9e44']] : [])] as [number, string, string][]) {
      if (sec < t0 || sec > t0 + dur) continue;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(sec), 14); ctx.lineTo(X(sec), 18 + H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillText(label, X(sec) + 3, 2);
    }
    // Eje de tiempo.
    ctx.fillStyle = 'rgba(20,20,20,.6)'; ctx.font = '11px var(--font-isans), system-ui, sans-serif'; ctx.textAlign = 'center';
    const step = [10, 30, 60, 120, 300].find((v) => (v / dur) * W > 60) ?? 300;
    for (let sec = Math.ceil(t0 / step) * step; sec <= t0 + dur; sec += step) { ctx.fillRect(X(sec), 18 + H, 1, 4); ctx.fillText(String(sec), X(sec), h - padB + 6); }
  }, [w, h, dpr, s, y, t0, dur, t]);

  // Reproducción: la señal remuestreada a 8 kHz con la aceleración elegida, y la marca de avance en el gráfico.
  const play = () => {
    if (audio.current) { audio.current.src.stop(); return; }
    if (!s || !y) return;
    const ctx = new AudioContext({ sampleRate: AUDIO_RATE });
    const n = Math.floor((dur / speed) * AUDIO_RATE), buf = ctx.createBuffer(1, n, AUDIO_RATE), out = buf.getChannelData(0);
    const step = (y.length - 1) / n;
    for (let i = 0; i < n; i++) { const x = i * step, k = Math.floor(x), f = x - k; out[i] = 0.9 * (y[k] * (1 - f) + (y[k + 1] ?? y[k]) * f); }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    const startAt = ctx.currentTime;
    let raf = 0;
    const tick = () => { setHead(Math.min(1, ((ctx.currentTime - startAt) * speed) / dur)); raf = requestAnimationFrame(tick); };
    src.onended = () => { cancelAnimationFrame(raf); setPlaying(false); setHead(null); audio.current = null; ctx.close().catch(() => {}); };
    // Algunos navegadores crean el contexto pausado hasta que se lo reanuda.
    ctx.resume().catch(() => {});
    src.start(); tick();
    audio.current = { ctx, src }; setPlaying(true);
  };
  useEffect(() => () => { audio.current?.src.stop(); }, []);

  const pv = !s ? '' : s.peak >= 1e-3 ? `${nf(s.peak * 1000, 2)} ${t.units.mm}` : `${nf(s.peak * 1e6, 1)} ${t.units.um}`;
  // El gráfico está siempre montado (oculto mientras carga), para que se mida su tamaño desde el principio.
  const plot = (
    <div ref={wrap} className="rs-plot" style={s ? undefined : { display: 'none' }}>
      <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label={s ? `${t.title}: ${t.station(`${s.net}.${s.sta}`, nf(s.distKm))}` : t.title} />
      {head != null && <span className="rs-head" style={{ left: `calc(8px + (100% - 16px) * ${head})` }} />}
    </div>
  );
  if (!s) return <section className="ev-extra"><h3 className="ev-extra-title">{t.title}</h3><p className="ed-note">{seis === 'loading' ? t.loading : t.none}</p>{plot}</section>;
  return (
    <section className="ev-extra rs">
      <h3 className="ev-extra-title">{t.title}</h3>
      <p className="ed-body">{t.station(`${s.net}.${s.sta}${s.site ? ` (${s.site})` : ''}`, nf(s.distKm))}</p>
      {plot}
      <p className="faint small rs-axis">{t.axis}</p>
      <button type="button" className="ed-button" onClick={play}>{playing ? t.stop : t.play(nf(speed))}</button>
      <p className="faint small">{t.peak(pv)}</p>
      <p className="ed-note">{t.text}</p>
      <p className="faint small">
        {t.credit} · {t.net} {s.net}{NET[s.net] ? `: ${NET[s.net]}` : ''} · <a href={`https://ds.iris.edu/mda/${s.net}/${s.sta}`} target="_blank" rel="noopener noreferrer">{s.net}.{s.sta} ↗</a>
      </p>
    </section>
  );
}
