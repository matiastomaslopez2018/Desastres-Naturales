'use client';
/*
 * Película del tsunami en 3D (three.js). Tres mundos que se alternan por capítulo:
 *   1. La fuente de cerca: fondo marino con la batimetría real, que se deforma (Okada) durante la ruptura;
 *      el agua copia esa deformación y después se mueve según la simulación fina de los primeros minutos.
 *   2. El océano: la cuenca entera con relieve, y la superficie del agua según la simulación.
 *   3. La costa: un modelo a escala real (1 unidad = 2 m) de una costa baja con casas; el agua sube con el
 *      nivel estimado en la orilla.
 * Las alturas del agua y del relieve están exageradas en los dos primeros mundos (se aclara en pantalla).
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { boxLon } from '@/lib/tsunami/presets';
import { chapterAt, progressIn, simTimeAt, smooth } from '@/lib/tsunami/movie';
import type { SceneProps } from './movieTypes';

const D2R = Math.PI / 180;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
// Colores fijos (se crean una vez: los bucles por vértice no deben reservar memoria).
const UPLIFT = new THREE.Color(0.85, 0.2, 0.2), SUBSID = new THREE.Color(0.15, 0.35, 0.85);
const W_UP = new THREE.Color(0.86, 0.26, 0.3), W_DOWN = new THREE.Color(0.08, 0.2, 0.55);
const O_UP = new THREE.Color(0.9, 0.22, 0.25), O_DOWN = new THREE.Color(0.05, 0.18, 0.5);
const G_OFF = new THREE.Color(0xffffff), G_GAUGE = new THREE.Color(0xff8c42), G_DART = new THREE.Color(0xffd43b);

/** Colores del fondo marino y de la tierra según la altura (m). */
function terrainColor(elev: number, out: THREE.Color) {
  if (elev < 0) {
    const f = Math.min(1, Math.sqrt(-elev / 7000));
    return out.setRGB(0.55 - 0.45 * f, 0.72 - 0.5 * f, 0.78 - 0.4 * f);
  }
  const f = Math.min(1, elev / 3500);
  if (elev > 3000) return out.setRGB(0.93, 0.93, 0.95);
  return out.setRGB(0.42 + 0.35 * f, 0.55 + 0.15 * f, 0.33 + 0.25 * f);
}

/**
 * Grilla de nx×ny vértices con índices de triángulos; posiciones y colores a completar. Con northNegZ, las filas
 * avanzan hacia −z (latitud hacia el norte), así los triángulos quedan mirando hacia arriba en los dos casos.
 */
function gridGeometry(nx: number, ny: number, northNegZ = true) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nx * ny * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nx * ny * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nx * ny * 3), 3));
  const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
  let p = 0;
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (northNegZ) { idx[p++] = a; idx[p++] = b; idx[p++] = c; idx[p++] = b; idx[p++] = d; idx[p++] = c; }
    else { idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d; }
  }
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
/** Normales por diferencias finitas en una grilla regular (más rápido que computeVertexNormals). */
function gridNormals(g: THREE.BufferGeometry, nx: number, ny: number, dx: number, dz: number) {
  const pos = g.attributes.position.array as Float32Array, nor = g.attributes.normal.array as Float32Array;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const yl = pos[3 * (i > 0 ? k - 1 : k) + 1], yr = pos[3 * (i < nx - 1 ? k + 1 : k) + 1];
    const yu = pos[3 * (j > 0 ? k - nx : k) + 1], yd = pos[3 * (j < ny - 1 ? k + nx : k) + 1];
    const nxv = -(yr - yl) / (2 * dx), nzv = -(yd - yu) / (2 * dz), l = Math.hypot(nxv, 1, nzv);
    nor[3 * k] = nxv / l; nor[3 * k + 1] = 1 / l; nor[3 * k + 2] = nzv / l;
  }
  g.attributes.normal.needsUpdate = true;
}

export default function MovieScene3D(p: SceneProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const propsRef = useRef(p);
  propsRef.current = p;

  useEffect(() => {
    const el = wrap.current!, P = propsRef.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch { P.onFail(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); P.onFail(); });

    const scene = new THREE.Scene();
    const sky = new THREE.Color('#a9cbe0');
    scene.background = sky;
    scene.fog = new THREE.Fog(sky, 200, 900);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 6000);
    const FOG = { close: new THREE.Fog(sky, 120, 420), ocean: new THREE.Fog(sky, 180, 700), coast: new THREE.Fog(sky, 400, 2600) };
    scene.add(new THREE.HemisphereLight(0xe6f0f7, 0x3a3a40, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-60, 120, 50);
    scene.add(sun);
    const col = new THREE.Color();
    // Mar liso alrededor de cada grilla, hasta la niebla, para que no se vean los bordes del bloque.
    const seaRing = (g: THREE.BufferGeometry, y: number, color: number) => {
      g.computeBoundingBox();
      const b = g.boundingBox!, R = 4000, e = 0.5;
      const shape = new THREE.Shape([new THREE.Vector2(-R, -R), new THREE.Vector2(R, -R), new THREE.Vector2(R, R), new THREE.Vector2(-R, R)]);
      shape.holes.push(new THREE.Path([new THREE.Vector2(b.min.x + e, -b.max.z + e), new THREE.Vector2(b.min.x + e, -b.min.z - e), new THREE.Vector2(b.max.x - e, -b.min.z - e), new THREE.Vector2(b.max.x - e, -b.max.z + e)]));
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color }));
      m.position.y = y;
      return m;
    };

    /* ── 1. La fuente de cerca ── */
    const L = P.local, F = P.fine;
    const lonCl = L.lon0 + ((L.nx - 1) * L.step) / 2, latCl = L.lat0 + ((L.ny - 1) * L.step) / 2, cosL = Math.cos(latCl * D2R);
    const SCc = 10, EZc = 2.0, WZc = 0.45; // 1 unidad = 0,1°; profundidad ×2 por km; agua ×0,45 por m
    const close = new THREE.Group();
    const cTerr = gridGeometry(L.nx, L.ny), cWater = gridGeometry(L.nx, L.ny);
    const cBase = new Float32Array(L.nx * L.ny);
    {
      const pos = cTerr.attributes.position.array as Float32Array, wpos = cWater.attributes.position.array as Float32Array;
      for (let j = 0; j < L.ny; j++) for (let i = 0; i < L.nx; i++) {
        const k = j * L.nx + i, x = (i * L.step + L.lon0 - lonCl) * cosL * SCc, z = -(j * L.step + L.lat0 - latCl) * SCc;
        cBase[k] = (-L.h[k] / 1000) * EZc;
        pos[3 * k] = x; pos[3 * k + 2] = z; wpos[3 * k] = x; wpos[3 * k + 2] = z;
      }
    }
    const cTerrMesh = new THREE.Mesh(cTerr, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const cWaterMat = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.82, shininess: 70, specular: 0x9fb8c8 });
    const cWaterMesh = new THREE.Mesh(cWater, cWaterMat);
    close.add(cTerrMesh, cWaterMesh, seaRing(cWater, -0.05, 0x74a6c6));
    scene.add(close);
    const dxC = L.step * cosL * SCc, dzC = L.step * SCc;

    function updateClose(rupture: number, tSim: number, showWave: boolean) {
      const tp = cTerr.attributes.position.array as Float32Array, tc = cTerr.attributes.color.array as Float32Array;
      const wp = cWater.attributes.position.array as Float32Array, wc = cWater.attributes.color.array as Float32Array;
      const fi = Math.min(L.frames.length - 1, tSim / L.frameS), a = Math.floor(fi), b = Math.min(L.frames.length - 1, a + 1), u = fi - a;
      const A = L.frames[a], B = L.frames[b];
      for (let k = 0; k < cBase.length; k++) {
        const dz = F.dz[k] * rupture, wet = L.h[k] >= 10;
        tp[3 * k + 1] = cBase[k] + dz * WZc;
        // Fondo teñido por la deformación: rojo donde sube, azul donde baja.
        terrainColor(-L.h[k], col);
        const m = Math.min(1, Math.abs(dz) / 4);
        if (dz > 0) col.lerp(UPLIFT, m * 0.8); else if (dz < 0) col.lerp(SUBSID, m * 0.8);
        tc[3 * k] = col.r; tc[3 * k + 1] = col.g; tc[3 * k + 2] = col.b;
        const eta = !wet ? 0 : showWave ? A[k] * (1 - u) + B[k] * u : dz;
        wp[3 * k + 1] = wet ? eta * WZc : tp[3 * k + 1] - 0.2;
        const q = Math.min(1, Math.abs(eta) / 3);
        col.setRGB(0.2, 0.47, 0.7);
        if (eta > 0) col.lerp(W_UP, q); else col.lerp(W_DOWN, q);
        wc[3 * k] = col.r; wc[3 * k + 1] = col.g; wc[3 * k + 2] = col.b;
      }
      cTerr.attributes.position.needsUpdate = true; cTerr.attributes.color.needsUpdate = true;
      cWater.attributes.position.needsUpdate = true; cWater.attributes.color.needsUpdate = true;
      gridNormals(cTerr, L.nx, L.ny, dxC, dzC); gridNormals(cWater, L.nx, L.ny, dxC, dzC);
    }

    /* ── 2. El océano ── */
    const Gd = P.grid, st = Math.max(1, Math.ceil(Gd.nx / 360));
    const onx = Math.floor((Gd.nx - 1) / st) + 1, ony = Math.floor((Gd.ny - 1) / st) + 1;
    const lonCo = Gd.lon0 + ((Gd.nx - 1) * Gd.step) / 2, latCo = Gd.lat0 + ((Gd.ny - 1) * Gd.step) / 2, cosO = Math.cos(latCo * D2R);
    const EZ = 0.35, WZ = 1.1; // profundidad 0,35 por km (1 unidad = 1°); agua hasta 1,1 unidades (escala raíz)
    const OX = (lon: number) => (boxLon(P.box, lon) - lonCo) * cosO, OZ = (lat: number) => -(lat - latCo);
    const ocean = new THREE.Group();
    const oTerr = gridGeometry(onx, ony), oWater = gridGeometry(onx, ony);
    const oIdx = new Int32Array(onx * ony);
    {
      const pos = oTerr.attributes.position.array as Float32Array, colA = oTerr.attributes.color.array as Float32Array, wpos = oWater.attributes.position.array as Float32Array;
      for (let b = 0; b < ony; b++) for (let a = 0; a < onx; a++) {
        const k = b * onx + a, gk = b * st * Gd.nx + a * st, lon = Gd.lon0 + a * st * Gd.step, lat = Gd.lat0 + b * st * Gd.step;
        oIdx[k] = gk;
        const elev = -Gd.h[gk];
        pos[3 * k] = OX(lon); pos[3 * k + 1] = (elev / 1000) * EZ * (elev > 0 ? 1.4 : 1); pos[3 * k + 2] = OZ(lat);
        wpos[3 * k] = pos[3 * k]; wpos[3 * k + 2] = pos[3 * k + 2];
        terrainColor(elev, col); colA[3 * k] = col.r; colA[3 * k + 1] = col.g; colA[3 * k + 2] = col.b;
      }
      gridNormals(oTerr, onx, ony, st * Gd.step * cosO, st * Gd.step);
    }
    const oTerrMesh = new THREE.Mesh(oTerr, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const oWaterMesh = new THREE.Mesh(oWater, new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.8, shininess: 50, specular: 0x8aa6b8 }));
    ocean.add(oTerrMesh, oWaterMesh, seaRing(oWater, -0.05, 0x74a6c6));
    // Mareógrafos y boyas DART: se encienden cuando llegó la ola observada.
    const gauges = P.gauges.filter((g) => g[2] > 0);
    const gMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, gauges.length));
    const mtx = new THREE.Matrix4();
    gauges.forEach((g, i) => { mtx.setPosition(OX(g[0]), 0.45, OZ(g[1])); gMesh.setMatrixAt(i, mtx); gMesh.setColorAt(i, G_OFF); });
    ocean.add(gMesh);
    scene.add(ocean);

    function updateOcean(tSim: number) {
      const fr = P.frames, fi = Math.max(0, Math.min(fr.length - 1, tSim / P.frameS)), a = Math.floor(fi), b = Math.min(fr.length - 1, a + 1), u = fi - a;
      const A = fr[a], B = fr[b];
      const wp = oWater.attributes.position.array as Float32Array, wc = oWater.attributes.color.array as Float32Array, tp = oTerr.attributes.position.array as Float32Array;
      for (let k = 0; k < oIdx.length; k++) {
        const gk = oIdx[k];
        if (!P.wet[gk]) { wp[3 * k + 1] = tp[3 * k + 1] - 0.3; wc[3 * k] = 0.2; wc[3 * k + 1] = 0.45; wc[3 * k + 2] = 0.65; continue; }
        // Promedio del bloque st×st (tomar una celda de cada st mezcla el ruido de escala de grilla) y se
        // descartan los escalones más bajos del cuantizado int8: si no, todo el océano parece granulado.
        let sum = 0, n = 0;
        for (let dj = 0; dj < st; dj++) for (let di = 0; di < st; di++) {
          const g2 = gk + dj * Gd.nx + di;
          if (g2 < P.wet.length && P.wet[g2]) { sum += A[g2] * (1 - u) + B[g2] * u; n++; }
        }
        const raw = sum / n / 127, q = Math.sign(raw) * Math.max(0, Math.abs(raw) - 3 / 127);
        wp[3 * k + 1] = q * WZ;
        col.setRGB(0.18, 0.45, 0.68);
        if (q > 0) col.lerp(O_UP, Math.min(1, q * 1.4)); else col.lerp(O_DOWN, Math.min(1, -q * 1.4));
        wc[3 * k] = col.r; wc[3 * k + 1] = col.g; wc[3 * k + 2] = col.b;
      }
      oWater.attributes.position.needsUpdate = true; oWater.attributes.color.needsUpdate = true;
      gridNormals(oWater, onx, ony, st * Gd.step * cosO, st * Gd.step);
      gauges.forEach((g, i) => gMesh.setColorAt(i, tSim >= g[2] * 60 ? (g[4] === 3 ? G_DART : G_GAUGE) : G_OFF));
      if (gMesh.instanceColor) gMesh.instanceColor.needsUpdate = true;
    }

    /* ── 3. La costa (1 unidad = 2 m) ── */
    const coast = new THREE.Group();
    const CNX = 260, CNZ = 160, X0 = -400, X1 = 2000, Z0 = -1500, Z1 = 1500;
    const groundY = (x: number, z: number) => (x < 0 ? Math.max(-40, x / 30) : x / 100) + Math.sin(z * 0.03) * 0.3 * Math.min(1, Math.max(0, x / 60));
    const cg = gridGeometry(CNX, CNZ, false);
    {
      const pos = cg.attributes.position.array as Float32Array, ca = cg.attributes.color.array as Float32Array;
      for (let j = 0; j < CNZ; j++) for (let i = 0; i < CNX; i++) {
        const k = j * CNX + i, x = lerp(X0, X1, i / (CNX - 1)), z = lerp(Z0, Z1, j / (CNZ - 1)), y = groundY(x, z);
        pos[3 * k] = x; pos[3 * k + 1] = y; pos[3 * k + 2] = z;
        if (x < 0) col.setRGB(0.55, 0.5, 0.4); else if (x < 35) col.setRGB(0.86, 0.79, 0.62); else col.setRGB(0.45, 0.6, 0.35);
        ca[3 * k] = col.r; ca[3 * k + 1] = col.g; ca[3 * k + 2] = col.b;
      }
      gridNormals(cg, CNX, CNZ, (X1 - X0) / (CNX - 1), (Z1 - Z0) / (CNZ - 1));
    }
    coast.add(new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ vertexColors: true })));
    // Casas de madera (bajas, techo de chapa) y edificios de hormigón.
    const rnd = (n: number) => ((Math.sin(n * 91.345) * 47453.21) % 1 + 1) % 1;
    for (let n = 0; n < 70; n++) {
      const x = 45 + rnd(n) * 600, z = -250 + rnd(n + 100) * 500, concrete = rnd(n + 7) < 0.18;
      const w = concrete ? 7 + rnd(n + 3) * 5 : 4 + rnd(n + 3) * 2.5, d = concrete ? 7 + rnd(n + 5) * 4 : 4 + rnd(n + 5) * 2, hh = concrete ? 6 + rnd(n + 9) * 10 : 3 + rnd(n + 9) * 1;
      const g = groundY(x, z);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), new THREE.MeshLambertMaterial({ color: concrete ? 0xbdbdb6 : [0xe6d5b2, 0xd9c1a0, 0xf1e4cf, 0xc9d6dc][n % 4] }));
      body.position.set(x, g + hh / 2, z);
      coast.add(body);
      if (!concrete) {
        const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 1.8, 4), new THREE.MeshLambertMaterial({ color: [0x9c4a2f, 0x6f7b83, 0x8a5a3a][n % 3] }));
        roof.rotation.y = Math.PI / 4; roof.position.set(x, g + hh + 0.9, z);
        coast.add(roof);
      }
    }
    const cwNX = 120, cwNZ = 40;
    const cw = gridGeometry(cwNX, cwNZ, false);
    {
      const pos = cw.attributes.position.array as Float32Array, ca = cw.attributes.color.array as Float32Array;
      for (let j = 0; j < cwNZ; j++) for (let i = 0; i < cwNX; i++) {
        const k = j * cwNX + i;
        pos[3 * k] = lerp(-2500, 1000, i / (cwNX - 1)); pos[3 * k + 2] = lerp(-1600, 1600, j / (cwNZ - 1));
        ca[3 * k] = 0.17; ca[3 * k + 1] = 0.42; ca[3 * k + 2] = 0.6;
      }
    }
    const cwMesh = new THREE.Mesh(cw, new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.86, shininess: 80, specular: 0xa9c4d4 }));
    coast.add(cwMesh);
    scene.add(coast);

    function updateCoast(tSim: number, wall: number) {
      const S = P.shore, i = Math.max(0, Math.min(S.length - 1, tSim / P.shoreDt)), a = Math.floor(i), b = Math.min(S.length - 1, a + 1);
      const level = (S[a] * (1 - (i - a)) + S[b] * (i - a)) / 2; // metros → unidades de 2 m
      const pos = cw.attributes.position.array as Float32Array;
      for (let k = 0; k < cwNX * cwNZ; k++) pos[3 * k + 1] = level + Math.sin(pos[3 * k] * 0.02 - wall * 1.5) * 0.25 + Math.sin(pos[3 * k + 2] * 0.03 + wall) * 0.15;
      cw.attributes.position.needsUpdate = true;
      gridNormals(cw, cwNX, cwNZ, 3500 / (cwNX - 1), 3200 / (cwNZ - 1));
      return level * 2;
    }

    /* ── Cámara por capítulo ── */
    const srcPos = v3(0, 0, 0);
    const ensureFar = () => {
      const s = P.sites.find((x, i) => i !== P.coastSite) ?? P.sites[0];
      return v3(OX(s.lon), 0, OZ(s.lat));
    };
    const srcO = v3(OX(lonCl), 0, OZ(latCl)), farO = ensureFar();
    const look = new THREE.Vector3();
    function placeCamera(mt: number) {
      const c = chapterAt(mt), u = progressIn(c, mt), su = smooth(u);
      if (c.id === 'quake') {
        const ang = lerp(0.55, 0.85, u);
        camera.position.set(-62 * Math.cos(ang), 30, 62 * Math.sin(ang) + 8); look.copy(srcPos).setY(-8);
      } else if (c.id === 'birth') {
        const ang = lerp(0.85, 1.1, su);
        camera.position.set(-lerp(62, 105, su) * Math.cos(ang), lerp(30, 85, su), lerp(62, 105, su) * Math.sin(ang) + 8); look.set(0, -6, 0);
      } else if (c.id === 'ocean') {
        const wide = v3(0, 115, 110), wideLook = v3(0, 0, 8);
        if (u < 0.3) { const k = smooth(u / 0.3); camera.position.lerpVectors(srcO.clone().add(v3(-6, 16, 20)), wide, k); look.lerpVectors(srcO, wideLook, k); }
        else if (u < 0.75) { const k = (u - 0.3) / 0.45; camera.position.copy(wide).add(v3(Math.sin(k * 1.2) * 12, 0, 0)); look.copy(wideLook); }
        else { const k = smooth((u - 0.75) / 0.25); camera.position.lerpVectors(wide.clone().add(v3(Math.sin(1.2) * 12, 0, 0)), farO.clone().add(v3(-10, 28, 32)), k); look.lerpVectors(wideLook, farO, k); }
      } else if (c.id === 'coast') {
        camera.position.set(lerp(-320, -230, su), lerp(55, 38, su), lerp(300, 230, su)); look.set(180, 4, 0);
      } else {
        const ang = u * 0.4;
        camera.position.set(Math.sin(ang) * 110, 120, Math.cos(ang) * 120); look.set(0, 0, 0);
      }
      camera.lookAt(look);
      close.visible = c.id === 'quake' || c.id === 'birth';
      ocean.visible = c.id === 'ocean' || c.id === 'end';
      coast.visible = c.id === 'coast';
      scene.fog = c.id === 'coast' ? FOG.coast : c.id === 'ocean' || c.id === 'end' ? FOG.ocean : FOG.close;
      return c.id;
    }

    /* ── Rótulos de lugares (HTML proyectado) ── */
    const labelEls = P.sites.map((s) => { const d = document.createElement('span'); d.className = 'mv-label'; d.textContent = s.name; labels.current?.appendChild(d); return d; });
    const tmp = new THREE.Vector3();
    function placeLabels(show: boolean, w: number, h: number) {
      P.sites.forEach((s, i) => {
        const d = labelEls[i];
        if (!show) { d.style.display = 'none'; return; }
        tmp.set(OX(s.lon), 0.6, OZ(s.lat)).project(camera);
        const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
        d.style.display = vis ? 'block' : 'none';
        d.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px)`;
      });
    }

    /* ── Tamaño y dibujo ── */
    let W = 0, H = 0;
    const resize = () => { W = el.clientWidth; H = el.clientHeight; renderer.setSize(W, H, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = W / Math.max(1, H); camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    const draw = (mt: number) => {
      const { t, rupture } = simTimeAt(mt, P.timing);
      const id = placeCamera(mt);
      if (id === 'quake' || id === 'birth') updateClose(rupture, id === 'birth' ? t : 0, id === 'birth');
      else if (id === 'ocean' || id === 'end') updateOcean(t);
      else updateCoast(t, mt);
      placeLabels(id === 'ocean' || id === 'end', W, H);
      renderer.render(scene, camera);
    };
    draw(P.clock.now());
    const unsub = P.clock.subscribe(draw);
    P.onReady?.();
    return () => {
      unsub(); ro.disconnect();
      labelEls.forEach((d) => d.remove());
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose(); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={wrap} className="mv-3d">
      <div ref={labels} className="mv-labels" aria-hidden="true" />
    </div>
  );
}
