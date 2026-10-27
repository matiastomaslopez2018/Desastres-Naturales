'use client';
/*
 * Película del sismo en 3D (three.js). Dos mundos que se alternan por capítulo:
 *   1. El bloque de corteza (km): el plano de la falla se rompe desde el hipocentro y después los frentes de
 *      onda P y S salen hacia el lugar. La cara del frente es el corte entre el epicentro y el lugar, con los
 *      tiempos de la marcha rápida en ak135 (los mismos del corte de la página); la cara de arriba muestra
 *      cuándo llega cada onda a la superficie.
 *   2. La cuadra (m): las ocho construcciones de la animación 2D, cada una oscilando con su oscilador al
 *      acelerograma sintético, con el daño típico de las funciones de GEM. El suelo se mueve con el
 *      desplazamiento real (doble integración del acelerograma).
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { qChapterAt, qProgress, qSimTimeAt, smooth } from '@/lib/quake/movie';
import { CONRAD, MOHO, sampleField, travelTimeField } from '@/lib/quake/waves';
import { groundDisplacement } from '@/lib/quake/synth';
import { rng } from '@/lib/quake/risk';
import { SIM_TEXT } from '@/lib/quake/text';
import { fmtNum } from '@/lib/format';
import { MATERIAL } from './cityDraw';
import { layout } from './City';
import { P_RGB, S_RGB } from './Section';
import type { QSceneProps } from './movieGeo';

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
const DS_COLOR = ['#2f9e44', '#e0a800', '#f08c00', '#e8590c', '#c92a2a'];
const SURF_RGB = [112, 72, 232] as const;
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Colores de las capas de la corteza y el manto según la profundidad (km), como en el corte de la página. */
const BAND_A = hex('#efe6d3'), BAND_B = hex('#e7dbc3'), MAN_A = hex('#dfcdb0'), MAN_B = hex('#d2b893');
function layerRGB(z: number, zMax: number, out: number[]) {
  if (z < CONRAD) { out[0] = BAND_A[0]; out[1] = BAND_A[1]; out[2] = BAND_A[2]; return; }
  if (z < MOHO) { out[0] = BAND_B[0]; out[1] = BAND_B[1]; out[2] = BAND_B[2]; return; }
  const u = clamp01((z - MOHO) / Math.max(1, zMax - MOHO));
  for (let k = 0; k < 3; k++) out[k] = MAN_A[k] + (MAN_B[k] - MAN_A[k]) * u;
}

/**
 * Mezcla los frentes P y S (y las ondas superficiales, si hay) sobre el fondo, como el corte de la página:
 * un frente marcado y una estela que se apaga.
 */
function composite(base: Uint8ClampedArray, tP: Float32Array, tS: Float32Array, out: Uint8ClampedArray, time: number, bandP: number, bandS: number, surf: { r: Float32Array; w: number } | null) {
  for (let i = 0; i < tP.length; i++) {
    let r = base[4 * i], g = base[4 * i + 1], b = base[4 * i + 2];
    const dtS = time - tS[i];
    if (dtS >= 0) { const al = dtS < bandS ? 0.95 : 0.3 * Math.exp(-(dtS - bandS) / (bandS * 10)); r = S_RGB[0] * al + r * (1 - al); g = S_RGB[1] * al + g * (1 - al); b = S_RGB[2] * al + b * (1 - al); }
    const dtP = time - tP[i];
    if (dtP >= 0) { const al = dtP < bandP ? 0.95 : 0.2 * Math.exp(-(dtP - bandP) / (bandP * 10)); r = P_RGB[0] * al + r * (1 - al); g = P_RGB[1] * al + g * (1 - al); b = P_RGB[2] * al + b * (1 - al); }
    if (surf && time > 0) for (const v of [3.5, 3.0]) {
      const d = Math.abs(surf.r[i] - v * time);
      if (d < surf.w) { const al = 0.85 * (1 - d / surf.w); r = SURF_RGB[0] * al + r * (1 - al); g = SURF_RGB[1] * al + g * (1 - al); b = SURF_RGB[2] * al + b * (1 - al); }
    }
    out[4 * i] = r; out[4 * i + 1] = g; out[4 * i + 2] = b; out[4 * i + 3] = 255;
  }
}

function canvasTex(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, ctx: c.getContext('2d')!, tex };
}

export default function QuakeScene3D(p: QSceneProps) {
  const wrap = useRef<HTMLDivElement>(null), labels = useRef<HTMLDivElement>(null), seis = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(p);
  propsRef.current = p;

  useEffect(() => {
    const el = wrap.current!, P = propsRef.current, T = SIM_TEXT[P.lang];
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch { P.onFail(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.insertBefore(renderer.domElement, el.firstChild);
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); P.onFail(); });

    const scene = new THREE.Scene();
    const DEEP = new THREE.Color('#16212c'), SKY = new THREE.Color('#bcd7ea');
    const cityFog = new THREE.Fog(SKY, 160, 1500);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 8000);
    scene.add(new THREE.HemisphereLight(0xf2f5f8, 0x5a5048, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(-60, 120, 80);
    scene.add(sun);

    /* ── 1. El bloque de corteza (1 unidad = 1/S km; profundidad × ve) ── */
    const { x0, x1, zMax, Lz, ve } = P.view, rup = P.rup;
    const S = 100 / Math.max(x1 - x0, Lz);
    const X = (x: number) => x * S, Y = (z: number) => -z * S * ve, Zs = (a: number) => a * S;
    const Wx = X(x1) - X(x0), Hs = -Y(zMax);
    const tect = new THREE.Group();
    scene.add(tect);
    // Tiempos de llegada en un corte que llega hasta la esquina más lejana del bloque (sirve para el frente y la superficie).
    const Rmax = Math.hypot(Math.max(-x0, x1), Lz) + 2;
    const FP = travelTimeField('P', P.depth, x0, Rmax, zMax, 320), FS = travelTimeField('S', P.depth, x0, Rmax, zMax, 320);
    const rgbTmp = [0, 0, 0];

    // Cara del frente: el corte (fondo por capas, frentes de onda, ruptura e hipocentro).
    const FW = 512, FH = Math.max(64, Math.min(512, Math.round((FW * zMax * ve) / (x1 - x0))));
    const front = canvasTex(FW, FH);
    const fBase = new Uint8ClampedArray(FW * FH * 4), fTP = new Float32Array(FW * FH), fTS = new Float32Array(FW * FH);
    for (let py = 0; py < FH; py++) for (let px = 0; px < FW; px++) {
      const i = py * FW + px, x = x0 + ((px + 0.5) / FW) * (x1 - x0), z = ((py + 0.5) / FH) * zMax;
      layerRGB(z, zMax, rgbTmp);
      fBase[4 * i] = rgbTmp[0]; fBase[4 * i + 1] = rgbTmp[1]; fBase[4 * i + 2] = rgbTmp[2]; fBase[4 * i + 3] = 255;
      fTP[i] = sampleField(FP, x, z); fTS[i] = sampleField(FS, x, z);
    }
    const fImg = front.ctx.createImageData(FW, FH);
    const fx = (x: number) => ((x - x0) / (x1 - x0)) * FW, fy = (z: number) => (z / zMax) * FH;
    const kmPerPx = (x1 - x0) / FW;
    function drawFront(time: number) {
      composite(fBase, fTP, fTS, fImg.data, time, (2 * kmPerPx) / 6.5, (2 * kmPerPx) / 3.8, null);
      const c = front.ctx;
      c.putImageData(fImg, 0, 0);
      c.strokeStyle = 'rgba(60,45,25,.5)'; c.lineWidth = 1.5; c.setLineDash([8, 6]);
      if (MOHO < zMax) { c.beginPath(); c.moveTo(0, fy(MOHO)); c.lineTo(FW, fy(MOHO)); c.stroke(); }
      c.setLineDash([]);
      c.font = '600 15px system-ui, sans-serif'; c.fillStyle = 'rgba(60,45,25,.8)';
      if (MOHO < zMax - 5) c.fillText(`${T.moho} · ${fmtNum(P.lang, MOHO)} km`, 10, fy(MOHO) - 7);
      c.strokeStyle = '#c8102e'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(fx(rup.top[0]), fy(rup.top[1])); c.lineTo(fx(rup.bottom[0]), fy(rup.bottom[1])); c.stroke();
      // Hipocentro: estrella.
      const hx = fx(0), hy = fy(P.depth);
      c.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 5 : 12; c.lineTo(hx + rr * Math.cos(a), hy + rr * Math.sin(a)); }
      c.closePath(); c.fillStyle = '#c8102e'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      front.tex.needsUpdate = true;
    }
    const frontMat = new THREE.MeshBasicMaterial({ map: front.tex, transparent: true });
    const frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(Wx, Hs), frontMat);
    frontMesh.position.set((X(x0) + X(x1)) / 2, -Hs / 2, 0);
    tect.add(frontMesh);

    // Cara de arriba: la superficie, con la hora de llegada de cada onda según la distancia al epicentro.
    const TW = 512, TH = Math.max(64, Math.min(1024, Math.round((TW * Lz) / (x1 - x0))));
    const top = canvasTex(TW, TH);
    const tBase = new Uint8ClampedArray(TW * TH * 4), tTP = new Float32Array(TW * TH), tTS = new Float32Array(TW * TH), tR = new Float32Array(TW * TH);
    {
      const r0 = rng(P.seed);
      const noise = Array.from({ length: 64 * 64 }, () => r0());
      for (let py = 0; py < TH; py++) for (let px = 0; px < TW; px++) {
        const i = py * TW + px, x = x0 + ((px + 0.5) / TW) * (x1 - x0), a = -Lz + ((py + 0.5) / TH) * Lz, r = Math.hypot(x, a);
        const n = noise[((py >> 3) % 64) * 64 + ((px >> 3) % 64)] * 14 - 7;
        tBase[4 * i] = 178 + n; tBase[4 * i + 1] = 172 + n; tBase[4 * i + 2] = 132 + n; tBase[4 * i + 3] = 255;
        tR[i] = r; tTP[i] = sampleField(FP, r, 0); tTS[i] = sampleField(FS, r, 0);
      }
    }
    const tImg = top.ctx.createImageData(TW, TH);
    const tx = (x: number) => ((x - x0) / (x1 - x0)) * TW, ty = (a: number) => ((a + Lz) / Lz) * TH;
    const half = Math.min(rup.length / 2, Lz);
    function drawTop(time: number) {
      composite(tBase, tTP, tTS, tImg.data, time, (2 * kmPerPx) / 6.5, (2 * kmPerPx) / 3.8, P.surface ? { r: tR, w: 3 * kmPerPx } : null);
      const c = top.ctx;
      c.putImageData(tImg, 0, 0);
      // Traza de la falla en la superficie, si la ruptura llega arriba; si no, su proyección punteada.
      const surfaceBreak = rup.top[1] < 1;
      c.strokeStyle = surfaceBreak ? '#c8102e' : 'rgba(200,16,46,.6)'; c.lineWidth = surfaceBreak ? 5 : 3; c.setLineDash(surfaceBreak ? [] : [10, 8]);
      c.beginPath(); c.moveTo(tx(rup.top[0]), ty(-half)); c.lineTo(tx(rup.top[0]), ty(0)); c.stroke(); c.setLineDash([]);
      // Epicentro.
      c.fillStyle = '#c8102e'; c.beginPath(); c.arc(tx(0), TH - 2, 9, Math.PI, 2 * Math.PI); c.fill();
      top.tex.needsUpdate = true;
    }
    const topMat = new THREE.MeshBasicMaterial({ map: top.tex, transparent: true });
    const topMesh = new THREE.Mesh(new THREE.PlaneGeometry(Wx, Zs(Lz)).rotateX(-Math.PI / 2), topMat);
    topMesh.position.set((X(x0) + X(x1)) / 2, 0, -Zs(Lz) / 2);
    tect.add(topMesh);

    // Costados y fondo con las capas.
    const side = canvasTex(4, 256);
    for (let py = 0; py < 256; py++) { layerRGB(((py + 0.5) / 256) * zMax, zMax, rgbTmp); side.ctx.fillStyle = `rgb(${rgbTmp.map((v) => Math.round(v * 0.86)).join(',')})`; side.ctx.fillRect(0, py, 4, 1); }
    side.tex.needsUpdate = true;
    const sideMat = new THREE.MeshLambertMaterial({ map: side.tex });
    const left = new THREE.Mesh(new THREE.PlaneGeometry(Zs(Lz), Hs).rotateY(-Math.PI / 2), sideMat);
    left.position.set(X(x0), -Hs / 2, -Zs(Lz) / 2);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(Zs(Lz), Hs).rotateY(Math.PI / 2), sideMat);
    right.position.set(X(x1), -Hs / 2, -Zs(Lz) / 2);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(Wx, Hs).rotateY(Math.PI), sideMat);
    back.position.set((X(x0) + X(x1)) / 2, -Hs / 2, -Zs(Lz));
    tect.add(left, right, back);

    // Plano de la falla (la mitad que queda dentro del bloque), con la ruptura que crece desde el hipocentro.
    const dipR = (rup.dip * Math.PI) / 180, W = rup.width;
    const dh = Math.max(0, Math.min(W, (P.depth - rup.top[1]) / Math.max(Math.sin(dipR), 1e-6)));
    const rMax = Math.hypot(rup.length / 2, Math.max(dh, W - dh));
    const fault = canvasTex(256, 256);
    const fGeo = new THREE.BufferGeometry();
    {
      const xt = X(rup.top[0]), yt = Y(rup.top[1]), xb = X(rup.bottom[0]), yb = Y(rup.bottom[1]), zb = -Zs(half);
      fGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([xt, yt, 0, xt, yt, zb, xb, yb, zb, xb, yb, 0]), 3));
      fGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
      fGeo.setIndex([0, 1, 2, 0, 2, 3]);
    }
    const faultMesh = new THREE.Mesh(fGeo, new THREE.MeshBasicMaterial({ map: fault.tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    tect.add(faultMesh);
    let lastRupture = -1;
    function drawFault(rupture: number) {
      if (Math.abs(rupture - lastRupture) < 0.002) return;
      lastRupture = rupture;
      const c = fault.ctx, R = rupture * rMax, kx = 256 / Math.max(half, 1e-3), ky = 256 / Math.max(W, 1e-3);
      c.clearRect(0, 0, 256, 256);
      c.fillStyle = 'rgba(255,214,214,.28)'; c.fillRect(0, 0, 256, 256);
      if (R > 0) {
        c.fillStyle = 'rgba(200,16,46,.82)'; c.beginPath(); c.ellipse(0, dh * ky, R * kx, R * ky, 0, 0, Math.PI * 2); c.fill();
        if (rupture < 1) { c.strokeStyle = '#ffd43b'; c.lineWidth = 5; c.stroke(); }
      }
      c.strokeStyle = 'rgba(200,16,46,.9)'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 253, 253);
      fault.tex.needsUpdate = true;
    }
    // Flechas del deslizamiento: bloque colgante (blanca) y bloque de abajo (amarilla).
    const dd = new THREE.Vector3(X(rup.bottom[0]) - X(rup.top[0]), Y(rup.bottom[1]) - Y(rup.top[1]), 0).normalize();
    const nrm = new THREE.Vector3(-dd.y, dd.x, 0);
    const mech = P.setting === 'interface' ? 'reverse' : P.mech;
    const hwDir = mech === 'strike-slip' ? new THREE.Vector3(0, 0, 1) : mech === 'normal' ? dd.clone() : dd.clone().negate();
    const along = -Zs(half) * 0.45;
    const hyp = new THREE.Vector3(X(rup.top[0]), Y(rup.top[1]), along).addScaledVector(dd, (dh * S * Math.hypot(Math.cos(dipR), Math.sin(dipR) * ve)));
    const aLen = Math.max(4, Math.min(16, W * S * 0.35));
    const arrows = [
      new THREE.ArrowHelper(hwDir, hyp.clone().addScaledVector(nrm, aLen * 0.45).addScaledVector(hwDir, -aLen / 2), aLen, 0xffffff, aLen * 0.35, aLen * 0.22),
      new THREE.ArrowHelper(hwDir.clone().negate(), hyp.clone().addScaledVector(nrm, -aLen * 0.45).addScaledVector(hwDir, aLen / 2), aLen, 0xffd43b, aLen * 0.35, aLen * 0.22),
    ];
    arrows.forEach((a) => tect.add(a));

    // El lugar: un puñado de edificios sobre el borde del corte.
    const town = new THREE.Group();
    {
      const r = rng(P.seed + 3), u = Math.max(0.6, Math.min(2.2, Wx / 60));
      for (let k = 0; k < 7; k++) {
        const h = u * (0.8 + r() * 2.2), b = new THREE.Mesh(new THREE.BoxGeometry(u * 0.8, h, u * 0.8), new THREE.MeshLambertMaterial({ color: k % 3 ? 0x3d4651 : 0x5b6672 }));
        b.position.set((k - 3) * u * 1.05, h / 2, -u * (0.7 + (k % 2) * 1.1));
        town.add(b);
      }
      town.position.set(X(P.dist), 0, 0);
    }
    tect.add(town);

    /* ── 2. La cuadra (metros) ── */
    const city = new THREE.Group();
    scene.add(city);
    const { lots, width: blockW } = layout();
    const B = P.block, dt = P.synth.dt;
    const at = (arr: Float32Array, time: number) => { const i = Math.floor(time / dt); return i >= 0 && i < arr.length ? arr[i] : 0; };
    const disp = groundDisplacement(P.synth.acc, dt);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x9fae8f }));
    ground.position.y = -0.02;
    scene.add(ground);
    const strip = (z0: number, z1: number, color: number, y = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(blockW + 400, z1 - z0).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color }));
      m.position.set(0, y, (z0 + z1) / 2);
      city.add(m);
    };
    strip(-12, 7.5, 0xb7ad97);
    strip(7.5, 11, 0xd6d2c8, 0.12);
    strip(11, 19, 0x4a4b4c, 0.02);
    strip(19, 22, 0xd6d2c8, 0.12);
    for (let x = -blockW / 2 - 200; x < blockW / 2 + 200; x += 6) { const d = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xefeee8 })); d.position.set(x, 0.04, 15); city.add(d); }
    // Cerros de fondo.
    [[-500, -900, 380, 150], [100, -1000, 460, 210], [650, -850, 360, 130], [-1100, -1150, 520, 240]].forEach(([x, z, r, h]) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), new THREE.MeshLambertMaterial({ color: 0xa9b6ae }));
      m.position.set(x, h / 2 - 5, z); scene.add(m); m.userData.city = true;
    });

    // Construcciones: caja con pisos y ventanas; el corte lateral sigue el primer modo (seno de la altura).
    const winTex = (kind: keyof typeof MATERIAL) => {
      const { c, ctx, tex } = canvasTex(64, 64), mat = MATERIAL[kind];
      ctx.fillStyle = mat.wall; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, 60, 64, 4);
      ctx.fillStyle = kind === 'rc-wall' ? '#6f8794' : '#7f9cab'; ctx.fillRect(kind === 'rc-wall' ? 6 : 18, 20, kind === 'rc-wall' ? 52 : 28, 26);
      ctx.strokeStyle = mat.frame; ctx.lineWidth = 3; ctx.strokeRect(kind === 'rc-wall' ? 6 : 18, 20, kind === 'rc-wall' ? 52 : 28, 26);
      void c;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    };
    type Bld = { pivot: THREE.Group; mesh: THREE.Mesh; roof: THREE.Mesh; base: Float32Array; H: number; w: number; d: number; dir: number; collapseAt: number; onset: number; ds: number; mat: THREE.MeshLambertMaterial };
    const r1 = rng(P.seed * 31 + 7);
    const blds: Bld[] = lots.map((lot, i) => {
      const d = lot.kind.startsWith('rc') ? 14 : 10, segs = Math.max(2, lot.floors * 2);
      const geo = new THREE.BoxGeometry(lot.w, lot.H, d, 1, segs, 1).translate(0, lot.H / 2, 0);
      const tex = winTex(lot.kind); tex.repeat.set(Math.max(1, Math.round(lot.w / 3)), lot.floors);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const mesh = new THREE.Mesh(geo, mat);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(lot.w + 0.4, 0.45, d + 0.4), new THREE.MeshLambertMaterial({ color: MATERIAL[lot.kind].roof }));
      const pivot = new THREE.Group();
      pivot.position.set(lot.x - blockW / 2 + lot.w / 2, 0, 0);
      pivot.add(mesh, roof);
      city.add(pivot);
      const b = B.bld[i];
      return { pivot, mesh, roof, base: Float32Array.from(geo.attributes.position.array as Float32Array), H: lot.H, w: lot.w, d, dir: r1() < 0.5 ? -1 : 1, collapseAt: b.peakAt + 0.15, onset: b.onset, ds: b.ds, mat };
    });
    // Escombros (cubitos con tiro balístico) y polvo (sprites que crecen y se apagan): todo función del tiempo.
    type Chunk = { b: number; t0: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; s: number };
    const chunks: Chunk[] = [];
    blds.forEach((b, i) => {
      const n = [0, 3, 10, 26, 60][b.ds];
      for (let k = 0; k < n; k++) chunks.push({
        b: i, t0: (b.ds === 4 ? b.collapseAt + r1() * 1.4 : b.onset + r1() * 3),
        x: (r1() - 0.5) * b.w, y: b.H * (b.ds === 4 ? r1() * 0.9 : 0.3 + r1() * 0.7), z: b.d / 2 + 0.3,
        vx: (r1() - 0.5) * 3, vy: r1() * 1.5, vz: 0.6 + r1() * (b.ds === 4 ? 4 : 2), s: (0.15 + r1() * 0.45) * (b.ds === 4 ? 1.7 : 1),
      });
    });
    const chunkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), Math.max(1, chunks.length));
    {
      const col = new THREE.Color();
      chunks.forEach((c, k) => { const dbr = MATERIAL[lots[c.b].kind].debris; chunkMesh.setColorAt(k, col.set(dbr[k % dbr.length])); });
      if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true;
    }
    city.add(chunkMesh);
    const dustTex = (() => {
      const { ctx, tex } = canvasTex(64, 64), g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
      g.addColorStop(0, 'rgba(220,210,195,1)'); g.addColorStop(1, 'rgba(220,210,195,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); tex.needsUpdate = true;
      return tex;
    })();
    type Puff = { sp: THREE.Sprite; b: number; t0: number; x: number; y: number; r: number; grow: number; a: number };
    const puffs: Puff[] = [];
    blds.forEach((b, i) => {
      const n = [0, 0, 2, 5, 14][b.ds];
      for (let k = 0; k < n; k++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0 }));
        city.add(sp);
        puffs.push({ sp, b: i, t0: b.ds === 4 ? b.collapseAt + 0.2 + r1() * 1.6 : b.onset + r1() * 3, x: (r1() - 0.5) * (b.w + 3), y: b.ds === 4 ? r1() * b.H * 0.4 : b.H * (0.3 + r1() * 0.6), r: 2 + r1() * 3, grow: b.ds === 4 ? 3 + r1() * 3 : 1 + r1(), a: b.ds === 4 ? 0.75 : 0.35 });
      }
    });
    // Árboles y autos.
    const trees = [1, 4, 6].map((li) => {
      const g = new THREE.Group(), x = lots[li].x - blockW / 2 + lots[li].w + 1.4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 3.2, 6).translate(0, 1.6, 0), new THREE.MeshLambertMaterial({ color: 0x5d4630 }));
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 0).translate(0, 4.4, 0), new THREE.MeshLambertMaterial({ color: 0x5a8a4e, flatShading: true }));
      g.add(trunk, crown); g.position.set(x, 0, 9.3); city.add(g);
      return g;
    });
    [[-20, 0xb4162f, 13], [8, 0x2d62c8, 17], [30, 0xe6e6e0, 13]].forEach(([x, color, z]) => {
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.8, 1.8).translate(0, 0.65, 0), new THREE.MeshLambertMaterial({ color }));
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 1.6).translate(-0.2, 1.35, 0), new THREE.MeshLambertMaterial({ color: 0xa9c9da }));
      car.add(body, cab); car.position.set(x, 0, z); city.add(car);
    });

    function updateCity(time: number) {
      const dx = at(disp, time);
      city.position.x = dx;
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      blds.forEach((b, i) => {
        const u = at(B.bld[i].u, time) * B.exag + (b.ds === 3 ? b.dir * 0.02 * b.H * clamp01((time - b.onset) / 1.2) : 0);
        const pos = b.mesh.geometry.attributes.position.array as Float32Array;
        for (let k = 0; k < pos.length; k += 3) { const y = b.base[k + 1]; pos[k] = b.base[k] + u * Math.sin((Math.PI / 2) * (y / b.H)); }
        b.mesh.geometry.attributes.position.needsUpdate = true;
        b.roof.position.set(u, b.H + 0.22, 0);
        // Colapso: los pisos se aplastan (con una leve inclinación) hasta quedar un montón.
        const c = b.ds === 4 ? smooth(clamp01((time - b.collapseAt) / 1.5)) : 0;
        b.pivot.scale.y = 1 - 0.86 * c;
        b.pivot.rotation.z = -b.dir * 0.09 * c;
        // Color: se oscurece un poco con el daño cuando aparece.
        const k = time >= b.onset ? [0, 0.04, 0.1, 0.18, 0.25][b.ds] : 0;
        b.mat.color.setScalar(1 - k);
      });
      chunks.forEach((c, k) => {
        const tau = time - c.t0, b = blds[c.b];
        if (tau < 0) { mtx.makeScale(0, 0, 0); chunkMesh.setMatrixAt(k, mtx); return; }
        const tHit = (c.vy + Math.sqrt(c.vy * c.vy + 2 * 9.81 * c.y)) / 9.81, tt = Math.min(tau, tHit);
        ps.set(b.pivot.position.x + c.x + c.vx * tt, Math.max(c.s / 2, c.y + c.vy * tt - 4.9 * tt * tt), c.z + c.vz * tt);
        q.setFromEuler(new THREE.Euler(tt * 3 + k, tt * 2, 0));
        sc.setScalar(c.s);
        chunkMesh.setMatrixAt(k, mtx.compose(ps, q, sc));
      });
      chunkMesh.instanceMatrix.needsUpdate = true;
      puffs.forEach((pf) => {
        const tau = time - pf.t0, b = blds[pf.b];
        if (tau < 0) { pf.sp.visible = false; return; }
        pf.sp.visible = true;
        const s = pf.r + pf.grow * Math.sqrt(tau) * 2;
        pf.sp.scale.set(s, s, 1);
        pf.sp.position.set(b.pivot.position.x + pf.x + tau * 0.4, pf.y + tau * 0.5, b.d / 2 + 1.5);
        (pf.sp.material as THREE.SpriteMaterial).opacity = pf.a * Math.max(0, 1 - tau / 9);
      });
      const tr = at(B.tree, time) * B.exag;
      trees.forEach((g) => { g.rotation.z = -tr / 6; });
    }

    /* ── Rótulos (HTML proyectado) ── */
    type Lab = { el: HTMLSpanElement; pos: THREE.Vector3 };
    const mkLab = (text: string, cls = 'mv-label') => { const d = document.createElement('span'); d.className = cls; d.textContent = text; labels.current?.appendChild(d); return d; };
    const tLabs: Lab[] = [
      { el: mkLab(T.hypocenter), pos: new THREE.Vector3(X(0), Y(P.depth), 0) },
      { el: mkLab(T.epicenter), pos: new THREE.Vector3(X(0), 0.5, 0) },
      { el: mkLab(P.siteLabel), pos: new THREE.Vector3(X(P.dist), Math.max(0.6, Math.min(2.2, Wx / 60)) * 3.6, -1) },
    ];
    const dsLabs = blds.map((b) => {
      const el = mkLab(T.ds[b.ds], 'mv-label mv-ds');
      el.style.background = DS_COLOR[b.ds];
      return { el, b };
    });
    const tmp = new THREE.Vector3();
    const place = (el: HTMLElement, v: THREE.Vector3, show: boolean, w: number, h: number) => {
      if (!show) { el.style.display = 'none'; return; }
      tmp.copy(v).project(camera);
      const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
      el.style.display = vis ? 'block' : 'none';
      el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px)`;
    };

    /* ── Sismograma (arriba a la derecha) ── */
    const sc = seis.current!, sctx = sc.getContext('2d')!;
    const SW = 300, SH = 64, seisDpr = Math.min(2, window.devicePixelRatio || 1);
    sc.width = SW * seisDpr; sc.height = SH * seisDpr;
    const tEnd = P.end;
    let amax = 1e-9;
    for (let i = 0; i < P.synth.acc.length; i++) amax = Math.max(amax, Math.abs(P.synth.acc[i]));
    function drawSeis(time: number, show: boolean) {
      sc.style.display = show ? 'block' : 'none';
      if (!show) return;
      sctx.setTransform(seisDpr, 0, 0, seisDpr, 0, 0);
      sctx.clearRect(0, 0, SW, SH);
      sctx.fillStyle = 'rgba(5,11,18,.72)'; sctx.beginPath(); sctx.roundRect(0, 0, SW, SH, 10); sctx.fill();
      const xs = (t: number) => 8 + (t / tEnd) * (SW - 16), mid = SH / 2 + 6;
      for (const [ta, col] of [[P.tP.t, P_RGB], [P.tS.t, S_RGB]] as const) { sctx.fillStyle = `rgb(${col.join(',')})`; sctx.fillRect(xs(ta), 14, 1.5, SH - 18); }
      sctx.strokeStyle = 'rgba(255,255,255,.9)'; sctx.lineWidth = 1; sctx.beginPath();
      const n = SW - 16;
      for (let k = 0; k <= n; k++) {
        const t = (k / n) * Math.min(time, tEnd);
        let m = 0;
        const i0 = Math.floor(t / dt), i1 = Math.floor(((k + 1) / n) * Math.min(time, tEnd) / dt);
        for (let i = i0; i <= Math.max(i0, i1) && i < P.synth.acc.length; i++) if (Math.abs(P.synth.acc[i]) > Math.abs(m)) m = P.synth.acc[i];
        const px = xs(t), py = mid - (m / amax) * (SH / 2 - 12);
        if (k) sctx.lineTo(px, py); else sctx.moveTo(px, py);
      }
      sctx.stroke();
      sctx.fillStyle = 'rgba(255,255,255,.75)'; sctx.font = '600 11px system-ui, sans-serif';
      sctx.fillText(`${T.seismogram} · t = ${fmtNum(P.lang, time, 1)} s`, 8, 12);
    }

    /* ── Cámara por capítulo ── */
    const cx = (X(x0) + X(x1)) / 2, cz = -Zs(Lz) / 2, D = Math.max(Wx, Zs(Lz), Hs);
    const look = new THREE.Vector3();
    const camFault = (u: number) => {
      const a = lerp(0.95, 0.62, u), R = 1.5 * D;
      camera.position.set(cx + Math.sin(a) * R * 0.75, R * 0.5, cz + Math.cos(a) * R);
      look.set(lerp(cx, hyp.x, 0.6), lerp(-Hs * 0.35, hyp.y, 0.5), lerp(cz, hyp.z, 0.6));
    };
    function placeCamera(mt: number) {
      const c = qChapterAt(mt), u = qProgress(c, mt), su = smooth(u);
      if (c.id === 'fault') camFault(u);
      else if (c.id === 'waves') {
        camFault(1);
        const k = smooth(clamp01(u / 0.3));
        const from = camera.position.clone(), lf = look.clone();
        camera.position.lerpVectors(from, new THREE.Vector3(cx + 0.18 * D, 0.62 * D, 0.95 * D + Hs * 0.3), k);
        look.lerpVectors(lf, new THREE.Vector3(cx, -Hs * 0.3, cz * 0.6), k);
      } else if (c.id === 'city') {
        camera.position.set(lerp(-blockW * 0.4, blockW * 0.1, su), lerp(9, 11, su), lerp(60, 64, su));
        look.set(lerp(-blockW * 0.12, blockW * 0.18, su), 7, 0);
      } else {
        camera.position.set(lerp(blockW * 0.1, -10, su), lerp(11, 62, su), lerp(64, 95, su));
        look.set(lerp(blockW * 0.18, 0, su), lerp(7, 2, su), 0);
      }
      // Pantallas angostas (celular vertical): la cámara se aleja para que entre lo mismo a lo ancho.
      const far = Math.max(1, 1.2 / camera.aspect) ** 0.85;
      if (far > 1) camera.position.sub(look).multiplyScalar(far).add(look);
      camera.lookAt(look);
      const isCity = c.id === 'city' || c.id === 'end';
      tect.visible = !isCity;
      city.visible = isCity; ground.visible = isCity;
      scene.traverse((o) => { if (o.userData.city) o.visible = isCity; });
      scene.background = isCity ? SKY : DEEP;
      scene.fog = isCity ? cityFog : null;
      return c;
    }

    /* ── Tamaño y dibujo ── */
    let Wpx = 0, Hpx = 0;
    const resize = () => { Wpx = el.clientWidth; Hpx = el.clientHeight; renderer.setSize(Wpx, Hpx, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = Wpx / Math.max(1, Hpx); camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let lastWaveT = -1;
    const draw = (mt: number) => {
      const { t, rupture } = qSimTimeAt(mt, P.timing);
      const c = placeCamera(mt), u = qProgress(c, mt);
      if (c.id === 'fault' || c.id === 'waves') {
        // Primero se ve adentro del bloque (caras translúcidas); al salir las ondas, el bloque se cierra.
        const op = c.id === 'fault' ? 0.32 : lerp(0.32, 1, smooth(clamp01(u / 0.2)));
        frontMat.opacity = op; topMat.opacity = Math.min(1, op + 0.1);
        drawFault(rupture);
        arrows.forEach((a) => { a.visible = c.id === 'fault' && rupture > 0.25; a.scale.setScalar(clamp01((rupture - 0.25) / 0.4) || 0.001); });
        if (t !== lastWaveT) { drawFront(t); drawTop(t); lastWaveT = t; }
        const shake = t >= P.tS.t ? Math.sin(t * 30) * 0.25 * Math.exp(-(t - P.tS.t) / 8) : 0;
        town.position.x = X(P.dist) + shake;
      } else updateCity(t);
      // Sacudón de la cámara en la cuadra, con la aceleración (vertical en la P, horizontal desde la S).
      if (c.id === 'city') {
        const a = at(P.synth.acc, t) / amax, k = Math.min(1, amax / 0.05) * 0.18;
        if (t >= P.tS.t) camera.position.x += a * k; else if (t >= P.tP.t) camera.position.y += a * k * 0.5;
      }
      const isCity = c.id === 'city' || c.id === 'end';
      tLabs.forEach((l, i) => place(l.el, l.pos, !isCity && (i !== 0 || c.id === 'fault' || u < 0.5), Wpx, Hpx));
      dsLabs.forEach(({ el, b }) => place(el, tmp.set(b.pivot.position.x + city.position.x, b.H * b.pivot.scale.y + 3, 0), isCity && b.ds > 0 && t >= b.onset, Wpx, Hpx));
      drawSeis(t, c.id === 'waves' || c.id === 'city');
      renderer.render(scene, camera);
    };
    draw(P.clock.now());
    const unsub = P.clock.subscribe(draw);
    return () => {
      unsub(); ro.disconnect();
      labels.current?.replaceChildren();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); });
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={wrap} className="mv-3d">
      <div ref={labels} className="mv-labels" aria-hidden="true" />
      <canvas ref={seis} className="mv-seis" style={{ width: 300, height: 64 }} aria-hidden="true" />
    </div>
  );
}
