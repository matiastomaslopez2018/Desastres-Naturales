'use client';
/*
 * Una cuadra durante el sismo. Cada construcción oscila con la respuesta de un oscilador de su período al
 * mismo acelerograma sintético del sismograma; el daño sale de las funciones de vulnerabilidad de GEM
 * (risk.ts) y aparece cuando la construcción alcanza su mayor respuesta. Árboles, cables y autos responden
 * al mismo movimiento. El dibujo vive en cityDraw.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK, blockOutcome, blockRisk, typicalDamage, rng, type Kind } from '@/lib/quake/risk';
import { sdof, type Synth } from '@/lib/quake/synth';
import type { Shaking } from '@/lib/quake/gmpe';
import { SIM_TEXT } from '@/lib/quake/text';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { prep, useCanvasSize, type Clock } from './clock';
import { G, damageFor, drawBuilding, drawChunks, drawDust, type Lot } from './cityDraw';

const DS_COLOR = ['#2f9e44', '#e0a800', '#f08c00', '#e8590c', '#c92a2a'];
const NICE = [1, 2, 5, 10, 20, 50, 100, 200];

/* ───────────── Cuadra (metros) ───────────── */

const SPEC: Record<Kind, { width: number; storey: number; roof: number }> = {
  adobe: { width: 9, storey: 3.4, roof: 1.3 },
  brick: { width: 7.5, storey: 3.0, roof: 0.7 },
  wood: { width: 7, storey: 3.0, roof: 2.2 },
  confined: { width: 8.5, storey: 2.8, roof: 0.6 },
  'rc-frame': { width: 12.5, storey: 3.0, roof: 0.9 },
  'rc-wall': { width: 15, storey: 3.2, roof: 1.2 },
};
const GAP = 2.8, MARGIN = 6;

export function layout(): { lots: Lot[]; width: number } {
  let x = MARGIN;
  const lots = BLOCK.map((b, i) => {
    const s = SPEC[b.kind];
    const lot: Lot = { i, x, w: s.width, storey: s.storey, floors: b.floors, roof: s.roof, kind: b.kind, H: s.storey * b.floors, tank: b.kind === 'brick' || b.kind === 'confined' || b.kind === 'rc-frame' };
    x += s.width + GAP;
    return lot;
  });
  return { lots, width: x - GAP + MARGIN };
}

/* ───────────── Componente ───────────── */

type Props = { lang: Lang; clock: Clock; synth: Synth; sh: Shaking; tP: number; tS: number; seed: number };

export function City({ lang, clock, synth, sh, tP, tS, seed }: Props) {
  const t = SIM_TEXT[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const { now, subscribe } = clock;
  const [roll, setRoll] = useState(0);
  useEffect(() => setRoll(0), [sh]);
  const risk = useMemo(() => blockRisk(sh), [sh]);
  // Vista inicial: el daño típico (mediano) de cada construcción; cada "otra tirada" sortea un resultado posible.
  const outcome = useMemo(() => (roll === 0 ? { eps: 0, items: typicalDamage(risk) } : blockOutcome(sh, seed + roll * 7919)), [sh, seed, roll, risk]);
  const { lots, width: sceneW } = useMemo(layout, []);

  // Respuesta de cada construcción (oscilador de su período), de los árboles y de los cables.
  const resp = useMemo(() => {
    const ag = Float64Array.from(synth.acc, (v) => v * G);
    const bld = BLOCK.map((b) => {
      const u = sdof(ag, synth.dt, b.T);
      let m = 0, at = 0;
      for (let i = 0; i < u.length; i++) if (Math.abs(u[i]) > m) { m = Math.abs(u[i]); at = i * synth.dt; }
      let onset = at;
      for (let i = 0; i < u.length; i++) if (Math.abs(u[i]) >= 0.6 * m) { onset = i * synth.dt; break; }
      return { u, peak: m, peakAt: Math.max(at, tS), onset: Math.max(onset, tS) };
    });
    let amax = 0;
    for (let i = 0; i < synth.acc.length; i++) amax = Math.max(amax, Math.abs(synth.acc[i]));
    return { bld, tree: sdof(ag, synth.dt, 0.9), cable: sdof(ag, synth.dt, 1.6, 0.02), amax };
  }, [synth, tS]);

  const damage = useMemo(() => {
    const r = rng(seed * 31 + roll * 101 + 7);
    return lots.map((lot, i) => damageFor(lot, outcome.items[i].ds, resp.bld[i].onset, resp.bld[i].peakAt + 0.15, r));
  }, [lots, outcome, resp, seed, roll]);

  // Exageración común de los desplazamientos de las construcciones (se informa en pantalla).
  const exag = useMemo(() => {
    const want = 0.9 / Math.max(...resp.bld.map((b) => b.peak), 1e-6);
    return NICE.reduce((best, k) => (k <= want ? k : best), 1);
  }, [resp]);

  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas || !w) return;
    const s = w / sceneW; // píxeles por metro
    const street = Math.max(40, 7.5 * s), base = h - street;
    const X = (m: number) => m * s, Y = (m: number) => base - m * s;
    const at = (arr: Float32Array, time: number) => { const i = Math.floor(time / synth.dt); return i >= 0 && i < arr.length ? arr[i] : 0; };
    // Fondo fijo: cordillera en dos planos y ciudad lejana (con su semilla, igual en cada cuadro).
    const r0 = rng(seed);
    const ridgeFar = Array.from({ length: 12 }, (_, i) => ({ x: (i / 11) * sceneW, hgt: 26 + r0() * 14 }));
    const ridgeNear = Array.from({ length: 9 }, (_, i) => ({ x: (i / 8) * sceneW + r0() * 6, hgt: 16 + r0() * 10 }));
    const skyline = Array.from({ length: 16 }, (_, i) => ({ x: (i / 15) * sceneW - 3, w: 5 + r0() * 7, hgt: 7 + r0() * 17, lit: r0() }));

    const draw = (time: number) => {
      const ctx = prep(canvas, w, h, dpr);
      if (!ctx) return;
      const a = at(synth.acc, time);
      // Cámara: sacude con la aceleración (vertical en la fase P, horizontal desde la S).
      const amp = Math.min(8, 8 * Math.abs(a) / Math.max(0.03, resp.amax)) * Math.min(1, resp.amax / 0.05);
      const camX = time >= tS ? Math.sign(a) * amp : 0, camY = time >= tP && time < tS ? Math.sign(a) * amp * 0.5 : 0;
      ctx.save();
      ctx.translate(camX, camY);

      // Cielo.
      const sky = ctx.createLinearGradient(0, 0, 0, base);
      sky.addColorStop(0, '#bcd7ea'); sky.addColorStop(0.7, '#e8eef0'); sky.addColorStop(1, '#f3efe6');
      ctx.fillStyle = sky; ctx.fillRect(-12, -12, w + 24, base + 12);
      // Cordillera (lejana más clara, con nieve) y cerros cercanos.
      const ridge = (pts: { x: number; hgt: number }[], col: string, snow: boolean) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-12, base);
        pts.forEach((p) => { ctx.lineTo(X(p.x) - X(5), Y(p.hgt * 0.62)); ctx.lineTo(X(p.x), Y(p.hgt)); });
        ctx.lineTo(w + 12, Y(pts[pts.length - 1].hgt * 0.6)); ctx.lineTo(w + 12, base); ctx.closePath(); ctx.fill();
        if (snow) { ctx.fillStyle = 'rgba(255,255,255,.9)'; pts.forEach((p) => { ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.hgt)); ctx.lineTo(X(p.x) - X(2), Y(p.hgt - 3.5)); ctx.lineTo(X(p.x) - X(0.6), Y(p.hgt - 2.6)); ctx.lineTo(X(p.x) + X(1.8), Y(p.hgt - 3.8)); ctx.closePath(); ctx.fill(); }); }
      };
      ridge(ridgeFar, '#c3ced6', true);
      ridge(ridgeNear, '#aab8b0', false);
      // Ciudad lejana (se mueve apenas).
      const far = at(resp.tree, time) * exag * 0.15 * s;
      skyline.forEach((b) => {
        ctx.fillStyle = '#c9cccb'; ctx.fillRect(X(b.x) + far, Y(b.hgt), X(b.w), X(b.hgt));
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        for (let yy = 1.5; yy < b.hgt - 1; yy += 3) for (let xx = 0.8; xx < b.w - 0.8; xx += 1.8) if ((xx * 7 + yy * 3 + b.lit * 10) % 3 < 1.4) ctx.fillRect(X(b.x + xx) + far, Y(yy + 1), X(0.7), X(0.9));
      });
      // Vereda (detrás de las construcciones).
      ctx.fillStyle = '#dcd8cf'; ctx.fillRect(-12, base, w + 24, street * 0.32);
      ctx.fillStyle = '#c9c4ba'; ctx.fillRect(-12, base + street * 0.3, w + 24, 3);

      // Postes y cables (péndulo poco amortiguado).
      const cab = at(resp.cable, time) * exag * 0.8;
      const poles = [2.6, sceneW / 2 + 1.4, sceneW - 2.6];
      for (const px of poles) { ctx.fillStyle = '#6a5642'; ctx.fillRect(X(px) - 2, Y(9.5), 4, X(9.5)); ctx.fillRect(X(px) - X(0.9), Y(9.1), X(1.8), 3); }
      ctx.strokeStyle = 'rgba(30,30,30,.85)'; ctx.lineWidth = 1;
      for (let j = 0; j < poles.length - 1; j++) for (const [hh, dx] of [[9.1, -0.8], [9.1, 0.8], [8.4, 0]]) {
        const x0 = X(poles[j] + dx), x1 = X(poles[j + 1] + dx);
        ctx.beginPath(); ctx.moveTo(x0, Y(hh)); ctx.quadraticCurveTo((x0 + x1) / 2 + cab * s * 2.5, Y(hh - 2), x1, Y(hh)); ctx.stroke();
      }

      // Construcciones, escombros y polvo (cada una en su sistema local, en metros).
      lots.forEach((lot, i) => {
        ctx.save();
        ctx.translate(X(lot.x), base); ctx.scale(s, -s);
        drawBuilding(ctx, lot, damage[i], { uRoof: at(resp.bld[i].u, time) * exag, time });
        ctx.restore();
      });
      lots.forEach((lot, i) => { ctx.save(); ctx.translate(X(lot.x), base); ctx.scale(s, -s); drawChunks(ctx, damage[i], time); ctx.restore(); });

      // Calle, árboles y autos.
      ctx.fillStyle = '#48494a'; ctx.fillRect(-12, base + street * 0.32 + 3, w + 24, street);
      ctx.fillStyle = '#9b978f'; ctx.fillRect(-12, base + street * 0.32, w + 24, 3);
      ctx.strokeStyle = '#efeee8'; ctx.lineWidth = 2; ctx.setLineDash([X(3), X(3)]);
      ctx.beginPath(); ctx.moveTo(-12, base + street * 0.72); ctx.lineTo(w + 12, base + street * 0.72); ctx.stroke(); ctx.setLineDash([]);
      const tr = at(resp.tree, time) * exag;
      for (const tx of [lots[1].x + lots[1].w + GAP / 2, lots[4].x + lots[4].w + GAP / 2, lots[6].x + lots[6].w + GAP / 2]) {
        ctx.strokeStyle = '#5d4630'; ctx.lineWidth = Math.max(2, 0.32 * s);
        ctx.beginPath(); ctx.moveTo(X(tx), base + street * 0.15); ctx.quadraticCurveTo(X(tx), Y(2.5), X(tx) + tr * s * 0.6, Y(4.2)); ctx.stroke();
        for (const [dx, dy, rr, col] of [[-0.9, 4.6, 1.5, '#4f7d45'], [0.9, 4.9, 1.4, '#5a8a4e'], [0, 5.7, 1.6, '#64965a']] as [number, number, number, string][]) {
          ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(X(tx + dx) + tr * s * (dy / 5.7), Y(dy), X(rr), X(rr * 0.85), 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const [cx, col] of [[lots[2].x + 1, '#b4162f'], [lots[5].x + 2, '#2d62c8'], [lots[7].x + 3, '#ececE6']] as [number, string][]) {
        const roll = Math.max(-0.1, Math.min(0.1, a * 0.5));
        ctx.save(); ctx.translate(X(cx + 2.2), base + street * 0.6); ctx.rotate(roll);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-X(2.2), X(0.05), X(4.4), X(0.18));
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(-X(2.2), 0); ctx.lineTo(-X(2.2), -X(0.75)); ctx.lineTo(-X(1.3), -X(0.85)); ctx.lineTo(-X(0.8), -X(1.5)); ctx.lineTo(X(1.0), -X(1.5)); ctx.lineTo(X(1.5), -X(0.85)); ctx.lineTo(X(2.2), -X(0.7)); ctx.lineTo(X(2.2), 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a9c9da'; ctx.fillRect(-X(0.7), -X(1.42), X(0.75), X(0.5)); ctx.fillRect(X(0.15), -X(1.42), X(0.75), X(0.5));
        ctx.fillStyle = '#1c1c1c'; for (const wx of [-1.35, 1.35]) { ctx.beginPath(); ctx.arc(X(wx), 0, X(0.38), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8c8c8c'; ctx.beginPath(); ctx.arc(X(wx), 0, X(0.16), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1c1c1c'; }
        ctx.restore();
      }
      // Polvo encima de todo.
      lots.forEach((lot, i) => { ctx.save(); ctx.translate(X(lot.x), base); ctx.scale(s, -s); drawDust(ctx, damage[i], time); ctx.restore(); });
      ctx.restore();

      // Rótulos: estado de cada construcción cuando aparece el daño.
      ctx.font = '600 11px var(--font-isans), system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lots.forEach((lot, i) => {
        const dm = damage[i];
        if (dm.ds === 0 || time < dm.onset) return;
        const txt = t.ds[dm.ds], tw = ctx.measureText(txt).width + 12;
        const cx = Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, X(lot.x + lot.w / 2))), cy = Math.max(30, Y(lot.H + lot.roof + 2.4));
        ctx.fillStyle = DS_COLOR[dm.ds]; ctx.beginPath(); ctx.roundRect(cx - tw / 2, cy - 9, tw, 18, 9); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy);
      });
      // Reloj, fase y exageración.
      ctx.textAlign = 'left'; ctx.font = '600 13px var(--font-isans), system-ui, sans-serif'; ctx.fillStyle = '#141414';
      const phase = time < tP ? '' : time < tS ? ` · ${t.waveP}` : ` · ${t.waveS}`;
      ctx.fillText(`t = ${fmtNum(lang, time, 1)} s${phase}`, 10, 14);
      ctx.textAlign = 'right'; ctx.font = '11px var(--font-isans), system-ui, sans-serif'; ctx.fillStyle = '#4a4a4a';
      ctx.fillText(t.exaggerated(exag), w - 8, 14);
    };
    draw(now());
    return subscribe(draw);
  }, [w, h, dpr, now, subscribe, lots, sceneW, damage, resp, exag, synth, tP, tS, seed, lang, t]);

  const eps = outcome.eps;
  return (
    <div className="qs-city">
      {/* En pantallas angostas la cuadra conserva un ancho mínimo y se recorre deslizando. */}
      <div className="qs-city-scroll">
      <div ref={wrap} className="qs-city-canvas">
        <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} role="img"
          aria-label={`${t.city}: ${lots.map((l, i) => `${t.kinds[l.kind]} (${t.floorsShort(l.floors)}): ${t.ds[outcome.items[i].ds]}`).join('; ')}`} />
      </div>
      </div>
      <div className="qs-city-bar">
        <button type="button" className="qs-chip" onClick={() => setRoll((r) => r + 1)}>{t.reroll}</button>
        <span className="qs-help">{roll === 0 ? t.mostLikely : Math.abs(eps) < 0.05 ? t.shakeMedian : t.shakeEps(fmtNum(lang, Math.abs(eps), 1), eps > 0)}</span>
      </div>
      <div className="ed-table-wrap">
        <table className="qs-table">
          <thead><tr><th scope="col">{t.colBuilding}</th><th scope="col">{t.colExpected}</th><th scope="col">{t.colExtensive}</th><th scope="col">{t.colThis}</th></tr></thead>
          <tbody>
            {risk.map((b, i) => (
              <tr key={b.cls.fn.id}>
                <th scope="row">{t.kinds[b.cls.kind]} · {t.floorsShort(b.cls.floors)}<br /><span className="qs-muted">{t.design[b.cls.design]} · {b.imt} {nf(b.im, 2)} g</span></th>
                <td>{nf(b.expected * 100, b.expected < 0.1 ? 1 : 0)} %</td>
                <td>{nf(b.pAtLeast[2] * 100)} %</td>
                <td><span className="qs-ds" style={{ background: DS_COLOR[outcome.items[i].ds] }}>{t.ds[outcome.items[i].ds]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
