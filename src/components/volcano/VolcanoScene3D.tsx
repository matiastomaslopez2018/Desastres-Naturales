'use client';
/*
 * El volcán en 3D (three.js): relieve real con la imagen Sentinel-2, la columna eruptiva y la nube que el
 * viento real arrastra, y la ceniza que se va depositando sobre el terreno.
 *
 * Unidades: 1 = 100 m; x hacia el este, z hacia el sur, y hacia arriba; el cráter en el origen.
 * La columna se dibuja con partículas cuya trayectoria es física en sus rasgos: suben con una velocidad
 * que decae hasta la altura de flotación neutra (~75 % del tope; el resto es el exceso de impulso) y se
 * desplazan con el viento de cada altura; arriba se abren en la nube paraguas, que el viento se lleva.
 * El tiempo de las partículas es real (minutos a horas) y se muestra acelerado.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { windAt, type WindProfile } from '@/lib/volcano/tephra';
import { at, type Slot } from '@/lib/volcano/timeline';
import type { Style } from '@/lib/volcano/presets';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { mmFromLoad } from './AshMap';

const VE = 1.5, U = 100; // exageración vertical del relieve; metros por unidad
const N_PART = 9000, N_SAMP = 96, N_CLASS = 6;

export type SceneProps = {
  lang: Lang;
  name: string; elev: number; boxKm: number; n: number;
  demUrl: string; imageUrl: string;
  style: Style;
  /** Por fase: tope de la columna (m s. n. m.) y viento. */
  phases: { top: number; wind: WindProfile }[];
  slots: Slot[]; masses: number[];
  local: Float32Array | null; localN: number;
  clock: { now: () => number; subscribe: (fn: (t: number) => void) => () => void };
  onFail: () => void;
  labels: { crater: string; top: (km: string) => string };
  /** Peligro que se muestra sobre el relieve (lava, flujos piroclásticos o lahares); null: la ceniza. */
  hazard: HazardLayer | null;
};

export type HazardLayer = { kind: 'lava' | 'pdc' | 'lahar'; value: Float32Array; arrival: Float32Array; n: number };

/**
 * Textura de humo: varios lóbulos redondeados superpuestos, sombreados de arriba hacia abajo, como las
 * "coliflores" de una columna eruptiva (se genera una vez, con semilla fija).
 */
function puffTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 22; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.24, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, rad = S * (0.14 + r() * 0.16);
    const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.35, rad * 0.1, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.6, 'rgba(225,225,225,.7)'); g.addColorStop(1, 'rgba(200,200,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Trayectorias de referencia para una fase: para cada clase de partícula (cuánto sube) y cada instante de
 * su vida, la posición (unidades). Vida en tiempo real: subida + nube paraguas.
 */
function trajectories(top: number, vent: number, wind: WindProfile, style: Style) {
  const Hc = Math.max(300, top - vent);
  const life = style === 'hawaiian' ? 900 : style === 'strombolian' ? 1500 : Math.min(7200, 1800 + Hc / 4);
  const out = new Float32Array(N_CLASS * N_SAMP * 4); // x, y, z, radio
  for (let c = 0; c < N_CLASS; c++) {
    // Altura máxima de esta clase: entre 55 % y 100 % del tope (las más altas son el exceso de impulso).
    const hMax = Hc * (0.55 + (0.45 * c) / (N_CLASS - 1)), wRise = Math.max(15, Math.sqrt(Hc) * 1.3);
    let x = 0, z = 0, h = 0, t = 0;
    const dt = life / (N_SAMP - 1);
    for (let k = 0; k < N_SAMP; k++) {
      const o = (c * N_SAMP + k) * 4;
      out[o] = x / U; out[o + 1] = (vent + h) / U; out[o + 2] = -z / U;
      // Radio: la columna se ensancha con la altura (~0,15·h) y arriba la nube paraguas se abre, en proporción
      // a la altura de la columna (hasta ~0,6 veces), a medida que pasa el tiempo.
      const umbrella = Math.max(0, t - (2 * hMax) / wRise);
      out[o + 3] = (80 + 0.15 * h + 0.6 * Hc * Math.sqrt(Math.min(1, umbrella / 3000))) / U;
      // Subida con velocidad que decae al acercarse a su altura máxima.
      const w = wRise * Math.max(0.02, 1 - h / hMax);
      h = Math.min(hMax, h + w * dt);
      const wd = windAt(wind, vent + h);
      x += wd.u * dt; z += wd.v * dt; t += dt;
    }
  }
  return { tab: out, life, Hc };
}

export default function VolcanoScene3D(p: SceneProps) {
  const wrap = useRef<HTMLDivElement>(null), labelsRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(p);
  propsRef.current = p;

  useEffect(() => {
    const el = wrap.current!, P = propsRef.current, labelBox = labelsRef.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch { P.onFail(); return; }
    // Resolución acotada: las bocanadas transparentes que se superponen son lo que más le cuesta a la placa.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMappingExposure = 1.35;
    el.insertBefore(renderer.domElement, el.firstChild);
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); P.onFail(); });
    let alive = true;

    const scene = new THREE.Scene();
    // Cielo: degradé vertical.
    {
      const c = document.createElement('canvas'); c.width = 2; c.height = 256;
      const ctx = c.getContext('2d')!, g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#4d7fae'); g.addColorStop(0.55, '#9fc2dc'); g.addColorStop(1, '#dfe8ee');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      scene.background = t;
    }
    const W = (2 * P.boxKm * 1000) / U, maxTop = Math.max(...P.phases.map((f) => f.top)), farR = Math.max(W, maxTop / U) * 6;
    scene.fog = new THREE.Fog(0xcfdde6, W * 0.9, farR * 0.9);
    const camera = new THREE.PerspectiveCamera(45, 1, 1, farR * 2);
    scene.add(new THREE.HemisphereLight(0xdfeaf5, 0x55503f, 1.0));
    const sun = new THREE.DirectionalLight(0xfff4e2, 2.2);
    sun.position.set(-0.6, 0.55, -0.45).multiplyScalar(1000);
    scene.add(sun);

    // Relieve y su imagen.
    const geo = new THREE.PlaneGeometry(W, W, P.n - 1, P.n - 1).rotateX(-Math.PI / 2);
    // Imagen: se le funden los bordes con el color medio del borde, que es también el de la planicie.
    // La textura se crea recién con la imagen cargada (cambiar el tamaño del lienzo después la deja negra).
    let tex: THREE.CanvasTexture | null = null;
    {
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        const S = img.width, texCanvas = document.createElement('canvas'); texCanvas.width = texCanvas.height = S;
        const ctx = texCanvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
        const small = document.createElement('canvas'); small.width = small.height = 32;
        const sctx = small.getContext('2d')!; sctx.drawImage(img, 0, 0, 32, 32);
        const d = sctx.getImageData(0, 0, 32, 32).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let k = 0; k < 32 * 32; k++) { const i = k % 32, j = (k / 32) | 0; if (i > 2 && j > 2 && i < 29 && j < 29) continue; r += d[4 * k]; g += d[4 * k + 1]; b += d[4 * k + 2]; n++; }
        const avg = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
        const edge = S * 0.09;
        for (const [x0, y0, x1, y1] of [[0, 0, edge, 0], [S, 0, S - edge, 0], [0, 0, 0, edge], [0, S, 0, S - edge]]) {
          const gr = ctx.createLinearGradient(x0, y0, x1, y1);
          gr.addColorStop(0, avg); gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.fillRect(0, 0, S, S);
        }
        skirtMat.color.set(avg).convertSRGBToLinear().multiplyScalar(1.45);
        tex = new THREE.CanvasTexture(texCanvas);
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        terrainMat.map = tex; terrainMat.needsUpdate = true;
        dirty = true;
      };
      img.src = P.imageUrl;
    }
    // Las imágenes Sentinel-2 en color real son oscuras: el material las aclara un poco.
    const terrainMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(1.45, 1.45, 1.45), roughness: 0.95, metalness: 0 });
    const terrain = new THREE.Mesh(geo, terrainMat);
    scene.add(terrain);
    let baseY = 0;
    fetch(P.demUrl).then((r) => r.arrayBuffer()).then((buf) => {
      if (!alive) return;
      const dem = new Int16Array(buf), pos = geo.attributes.position.array as Float32Array;
      let min = Infinity;
      dem.forEach((h) => { min = Math.min(min, h); });
      baseY = (min * VE) / U;
      // En el 8 % del borde el relieve baja suave hasta el mínimo, para empalmar con la planicie de alrededor.
      for (let k = 0; k < dem.length; k++) {
        const i = k % P.n, j = Math.floor(k / P.n), e = Math.min(i, j, P.n - 1 - i, P.n - 1 - j) / (P.n * 0.08), w = e >= 1 ? 1 : e * e * (3 - 2 * e);
        pos[3 * k + 1] = ((min + (dem[k] - min) * w) * VE) / U;
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
      ash.geometry = geo;
      skirt.position.y = baseY - 0.05;
      dirty = true;
    }).catch(() => {});
    // Planicie alrededor hasta el horizonte (color medio de la región), para que no se vea el borde.
    const skirtGeo = new THREE.PlaneGeometry(farR * 2, farR * 2).rotateX(-Math.PI / 2);
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 1 });
    const skirt = new THREE.Mesh(skirtGeo, skirtMat);
    scene.add(skirt);

    // Ceniza depositada: misma malla, un poco arriba, con transparencia según el espesor calculado.
    const ashCanvas = document.createElement('canvas'); ashCanvas.width = ashCanvas.height = Math.max(2, P.localN);
    const ashTex = new THREE.CanvasTexture(ashCanvas);
    const ashMat = new THREE.MeshStandardMaterial({ color: 0x8d8780, roughness: 1, transparent: true, alphaMap: ashTex, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const ash = new THREE.Mesh(geo, ashMat);
    scene.add(ash);
    function paintAsh(local: Float32Array | null, n: number) {
      ashCanvas.width = ashCanvas.height = Math.max(2, n);
      const ctx = ashCanvas.getContext('2d')!, img = ctx.createImageData(n, n);
      if (local) for (let k = 0; k < n * n; k++) {
        // Opacidad: nada bajo 0,1 mm; casi tapado desde ~5 cm (escala logarítmica).
        const mm = mmFromLoad(local[k]), a = mm <= 0.1 ? 0 : Math.min(1, Math.log10(mm / 0.1) / Math.log10(500));
        img.data[4 * k] = img.data[4 * k + 1] = img.data[4 * k + 2] = Math.round(255 * a); img.data[4 * k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      ashTex.needsUpdate = true;
    }
    paintAsh(P.local, P.localN);

    // Peligro sobre el relieve: textura RGBA que se va revelando según el avance de la animación.
    const hzCanvas = document.createElement('canvas'); hzCanvas.width = hzCanvas.height = P.n;
    const hzTex = new THREE.CanvasTexture(hzCanvas); hzTex.colorSpace = THREE.SRGBColorSpace;
    const hzMat = new THREE.MeshStandardMaterial({ map: hzTex, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, emissive: 0x000000, emissiveMap: hzTex });
    const hz = new THREE.Mesh(geo, hzMat);
    hz.visible = false;
    scene.add(hz);
    let hzLayer: HazardLayer | null = P.hazard, hzShown = -1;
    const hzCtx = hzCanvas.getContext('2d')!;
    let hzImg = hzCtx.createImageData(P.n, P.n);
    function paintHazard(progress: number) {
      if (!hzLayer) { hz.visible = false; return; }
      const L = hzLayer, step = Math.round(progress * 200) / 200;
      if (step === hzShown) return;
      hzShown = step;
      if (hzImg.width !== L.n) { hzCanvas.width = hzCanvas.height = L.n; hzImg = hzCtx.createImageData(L.n, L.n); }
      const d = hzImg.data;
      for (let k = 0; k < L.n * L.n; k++) {
        const v = L.value[k], on = v > 0.01 && L.arrival[k] <= step;
        if (!on) { d[4 * k + 3] = 0; continue; }
        // Lava: amarillo en el frente que avanza y rojo oscuro detrás (se enfría). Flujo piroclástico: gris claro.
        // Lahar: barro marrón.
        if (L.kind === 'lava') {
          const age = Math.max(0, step - L.arrival[k]), hot = Math.max(0, 1 - age * 6);
          d[4 * k] = 255; d[4 * k + 1] = Math.round(70 + 150 * hot); d[4 * k + 2] = Math.round(20 + 40 * hot); d[4 * k + 3] = Math.round(255 * Math.min(1, 0.35 + v * 3));
        } else if (L.kind === 'pdc') {
          // Más denso cerca de la boca (más energía) y casi transparente en el borde del alcance.
          d[4 * k] = 184; d[4 * k + 1] = 178; d[4 * k + 2] = 168; d[4 * k + 3] = Math.round(255 * Math.min(0.85, 0.08 + 0.7 * (v - 0.35) / 0.65));
        } else {
          d[4 * k] = 122; d[4 * k + 1] = 92; d[4 * k + 2] = 60; d[4 * k + 3] = 235;
        }
      }
      hzCtx.putImageData(hzImg, 0, 0);
      hzTex.needsUpdate = true;
      hz.visible = true;
      hzMat.emissive.setHex(L.kind === 'lava' ? 0xffffff : 0x000000);
      hzMat.emissiveIntensity = L.kind === 'lava' ? 1.2 : 0;
    }


    // Partículas de la columna.
    const tex2 = puffTexture();
    const pos = new Float32Array(N_PART * 3), col = new Float32Array(N_PART * 3), size = new Float32Array(N_PART), alpha = new Float32Array(N_PART);
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    pgeo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    pgeo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    const pmat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex2 }, scale: { value: 400 }, maxSize: { value: 300 }, alphaScale: { value: 1 }, fogColor: { value: new THREE.Color(0xcfdde6) }, fogNear: { value: W * 0.9 }, fogFar: { value: farR * 0.9 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vCol; varying float vA; varying float vDepth; uniform float scale; uniform float maxSize; uniform float alphaScale;
        void main(){ vCol=color; vA=min(1.0,alpha*alphaScale); vec4 mv=modelViewMatrix*vec4(position,1.0); vDepth=-mv.z; gl_PointSize=min(maxSize,size*scale/max(1.0,-mv.z)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying vec3 vCol; varying float vA; varying float vDepth;
        void main(){ vec4 t=texture2D(map,gl_PointCoord); float f=smoothstep(fogNear,fogFar,vDepth); gl_FragColor=vec4(mix(vCol*(0.55+0.6*t.r),fogColor,f*0.7), t.a*vA); if(gl_FragColor.a<0.01) discard; }`,
      transparent: true, depthWrite: false,
    });
    const points = new THREE.Points(pgeo, pmat);
    points.frustumCulled = false;
    scene.add(points);
    // Lava (fuentes y bombas): puntos brillantes con mezcla aditiva.
    const N_LAVA = 900, lpos = new Float32Array(N_LAVA * 3), lsize = new Float32Array(N_LAVA), lalpha = new Float32Array(N_LAVA), lcol = new Float32Array(N_LAVA * 3);
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3)); lgeo.setAttribute('size', new THREE.BufferAttribute(lsize, 1)); lgeo.setAttribute('alpha', new THREE.BufferAttribute(lalpha, 1)); lgeo.setAttribute('color', new THREE.BufferAttribute(lcol, 3));
    const lmat = pmat.clone(); lmat.blending = THREE.AdditiveBlending; lmat.uniforms.map.value = tex2;
    const lava = new THREE.Points(lgeo, lmat); lava.frustumCulled = false; scene.add(lava);

    const rnd = (k: number, s: number) => { const x = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
    const sunDir = sun.position.clone().normalize();
    const trajs = P.phases.map((f) => trajectories(f.top, P.elev, f.wind, P.style));
    const ventY = (P.elev * VE) / U;

    function updatePlume(t: number) {
      const st = at(P.slots, P.masses, t);
      const phase = st.phase >= 0 ? st.phase : Math.max(0, st.last);
      const tr = trajs[phase], tab = tr.tab;
      // Edad de cada partícula en tiempo real: nacen a lo largo de la fase; después de la fase se apagan.
      const s = P.slots[phase], animInPhase = t - s.start, phaseLen = s.end - s.start;
      const pulsed = P.style === 'strombolian' || P.style === 'vulcanian';
      // Segundos reales de vida de las partículas por segundo de animación: la columna se forma en ~3,5 s.
      const speed = tr.life / 3.5;
      // Escala de la columna (1 desde ~10 km): bocanadas más chicas y más transparentes en columnas bajas.
      const colScale = Math.min(1, tr.Hc / 10000);
      for (let k = 0; k < nVis; k++) {
        // Cada partícula nace por primera vez `b` s (reales) después del inicio de la fase y renace cada `life`.
        const c = k % N_CLASS, b = rnd(k, 1) * tr.life, el = animInPhase * speed, endEl = phaseLen * speed;
        let age = 0, vis = 0;
        if (pulsed) {
          // Explosiones: pulsos cada ~3,5 s de animación (estromboliana) o una sola por fase (vulcaniana).
          const period = P.style === 'strombolian' ? 3.5 : phaseLen + 1;
          const ph = ((Math.max(0, animInPhase) + rnd(k, 7) * 0.4) % period) / period;
          age = ph * tr.life * (P.style === 'strombolian' ? 0.35 : 1);
          vis = animInPhase >= 0 && animInPhase <= phaseLen + 2 ? Math.min(1, (phaseLen + 2 - animInPhase) / 2) : 0;
        } else if (el >= b) {
          const cut = Math.min(el, endEl);
          if (cut >= b) {
            age = ((cut - b) % tr.life) + (el - cut);
            // Después de la fase: siguen envejeciendo y se desvanecen.
            vis = el <= endEl ? 1 : Math.max(0, 1 - (el - endEl) / (tr.life * 0.6));
          }
        }
        const u = Math.min(N_SAMP - 1.001, (age / tr.life) * (N_SAMP - 1)), i0 = Math.floor(u), f = u - i0;
        const o0 = (c * N_SAMP + i0) * 4, o1 = o0 + 4;
        const cx = tab[o0] + (tab[o1] - tab[o0]) * f, cy = tab[o0 + 1] + (tab[o1 + 1] - tab[o0 + 1]) * f, cz = tab[o0 + 2] + (tab[o1 + 2] - tab[o0 + 2]) * f, rr = tab[o0 + 3] + (tab[o1 + 3] - tab[o0 + 3]) * f;
        // Desplazamiento dentro de la columna: dirección al azar, radio con distribución gaussiana.
        const th = rnd(k, 2) * Math.PI * 2, rr2 = rr * Math.sqrt(-2 * Math.log(Math.max(1e-4, rnd(k, 3)))) * 0.6;
        const ox = Math.cos(th) * rr2, oz = Math.sin(th) * rr2, oy = (rnd(k, 4) - 0.5) * rr * 0.5;
        // Altura en la escena: el relieve está exagerado ×1,5 pero el aire no; se suma desde el cráter.
        const yy = ventY + (cy - P.elev / U) + oy;
        pos[3 * k] = cx + ox; pos[3 * k + 1] = Math.max(ventY - 2, yy); pos[3 * k + 2] = cz + oz;
        // Color: oscuro cerca del cráter, más claro arriba; la cara al sol más clara.
        const hFrac = Math.min(1, (cy - P.elev / U) / (tr.Hc / U));
        const lit = 0.4 + 0.75 * Math.max(0, (ox * sunDir.x + oy * sunDir.y + oz * sunDir.z) / Math.max(1e-3, Math.hypot(ox, oy, oz)));
        // Variación de cada bocanada (la columna no es pareja: tiene "coliflores" más claras y más oscuras).
        const base = (0.26 + 0.4 * hFrac) * (0.8 + 0.4 * rnd(k, 6));
        const g = base * lit;
        col[3 * k] = g * 1.02; col[3 * k + 1] = g * 0.98; col[3 * k + 2] = g * 0.94;
        size[k] = (rr * 1.05 + 4 * colScale) * (0.45 + 0.9 * rnd(k, 5));
        const fadeEnd = Math.min(1, (1 - age / (tr.life * 1.6)) * 2.2);
        alpha[k] = vis * Math.max(0, fadeEnd) * (P.style === 'hawaiian' ? 0.05 : 0.26) * (0.25 + 0.75 * colScale);
      }
      pgeo.attributes.position.needsUpdate = true; pgeo.attributes.color.needsUpdate = true; pgeo.attributes.size.needsUpdate = true; pgeo.attributes.alpha.needsUpdate = true;
      // Lava: fuentes (hawaiana) o bombas balísticas (estromboliana y vulcaniana).
      const active = st.phase >= 0;
      const fountainH = P.style === 'hawaiian' ? 4 : P.style === 'strombolian' ? 3 : P.style === 'vulcanian' ? 6 : 8; // unidades
      for (let k = 0; k < N_LAVA; k++) {
        const period = P.style === 'strombolian' ? 3.5 : 1.6, ph = (((t + rnd(k, 9) * period) % period) / period);
        const v0 = Math.sqrt(2 * 9.81 * fountainH * U) * (0.6 + 0.4 * rnd(k, 10)) / U, ang = rnd(k, 11) * Math.PI * 2, tilt = (P.style === 'hawaiian' ? 0.12 : 0.35) * rnd(k, 12);
        const tt = ph * 2 * v0 / (9.81 / U) * 1.1;
        const vy = v0 * Math.cos(tilt), vh = v0 * Math.sin(tilt);
        const y = vy * tt - 0.5 * (9.81 / U) * tt * tt;
        lpos[3 * k] = Math.cos(ang) * vh * tt; lpos[3 * k + 1] = ventY + Math.max(-1, y); lpos[3 * k + 2] = Math.sin(ang) * vh * tt;
        // Tamaño de cada bomba o gota en proporción a la altura de la fuente (se ven sin tapar el cráter).
        lsize[k] = fountainH * (0.25 + 0.35 * rnd(k, 13));
        const hot = Math.max(0, 1 - ph);
        lcol[3 * k] = 1; lcol[3 * k + 1] = 0.35 + 0.4 * hot; lcol[3 * k + 2] = 0.08;
        lalpha[k] = active && y > -1 && (P.style !== 'subplinian' && P.style !== 'plinian') ? 0.55 : 0;
      }
      lgeo.attributes.position.needsUpdate = true; lgeo.attributes.size.needsUpdate = true; lgeo.attributes.alpha.needsUpdate = true; lgeo.attributes.color.needsUpdate = true;
      ashMat.opacity = hzLayer ? 0 : 0.92 * st.deposited;
      points.visible = hzLayer?.kind !== 'lahar'; lava.visible = points.visible;
      paintHazard(Math.min(1, t / (P.slots[P.slots.length - 1]?.end || 1)));
      return { st, phase };
    }

    // Controles de cámara.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = W * 0.15; controls.maxDistance = farR * 0.6;
    const tgt = new THREE.Vector3(0, ventY + Math.min(maxTop - P.elev, 12000) / U * 0.45, 0);
    controls.target.copy(tgt);
    // Columnas bajas (hawaiana, estromboliana): la cámara se acerca para que se vean las fuentes de lava.
    const dist = Math.max(maxTop - P.elev < 4000 ? W * 0.32 : W * 1.1, ((maxTop - P.elev) / U) * 1.5);
    camera.position.set(-dist * 0.75, ventY + dist * 0.42, dist * 0.75);
    controls.update();

    // Rótulos HTML.
    const mk = (text: string) => { const d = document.createElement('span'); d.className = 'vs-label'; d.textContent = text; labelBox?.appendChild(d); return d; };
    const crater = mk(P.labels.crater), topLab = mk('');
    const v = new THREE.Vector3();
    const place = (d: HTMLElement, x: number, y: number, z: number, show: boolean) => {
      v.set(x, y, z).project(camera);
      const ok = show && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      d.style.display = ok ? 'block' : 'none';
      if (ok) d.style.transform = `translate(${((v.x + 1) / 2) * Wpx}px, ${((1 - v.y) / 2) * Hpx}px)`;
    };

    let Wpx = 0, Hpx = 0, dirty = true, nVis = N_PART;
    const resize = () => {
      Wpx = el.clientWidth; Hpx = el.clientHeight; renderer.setSize(Wpx, Hpx, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      camera.aspect = Wpx / Math.max(1, Hpx); camera.updateProjectionMatrix();
      for (const m of [pmat, lmat]) { m.uniforms.scale.value = Hpx * 0.9; m.uniforms.maxSize.value = Hpx * 0.45; }
      dirty = true;
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    // Solo se recalcula lo que cambió: las partículas si avanzó el tiempo (o cambió la calidad) y el cuadro si
    // además se movió la cámara. La cantidad de partículas se adapta a lo que el equipo puede dibujar.
    let lastT = -1, cached: ReturnType<typeof updatePlume> | null = null, frameMs = 16, lastFrame = performance.now(), slow = 0, fast = 0;
    function draw() {
      const now = performance.now(), dtF = now - lastFrame;
      lastFrame = now;
      const t = P.clock.now(), moved = controls.update();
      if (t !== lastT) frameMs = frameMs * 0.9 + Math.min(100, dtF) * 0.1;
      if (frameMs > 26 && nVis > 2400) { if (++slow > 20) { nVis = Math.max(2400, Math.round(nVis * 0.75)); slow = 0; dirty = true; } } else slow = 0;
      if (frameMs < 14 && nVis < N_PART) { if (++fast > 120) { nVis = Math.min(N_PART, Math.round(nVis * 1.25)); fast = 0; dirty = true; } } else fast = 0;
      if (!moved && !dirty && t === lastT && cached) return;
      if (t !== lastT || dirty || !cached) {
        pgeo.setDrawRange(0, nVis);
        pmat.uniforms.alphaScale.value = Math.sqrt(N_PART / nVis);
        cached = updatePlume(t);
        lastT = t;
      }
      dirty = false;
      const { st, phase } = cached;
      const top = P.phases[phase].top;
      place(crater, 0, ventY + 1, 0, true);
      topLab.textContent = P.labels.top(fmtNum(P.lang, top / 1000, 1));
      place(topLab, trajs[phase].tab[((N_CLASS - 1) * N_SAMP + 20) * 4], ventY + (top - P.elev) / U, trajs[phase].tab[((N_CLASS - 1) * N_SAMP + 20) * 4 + 2], st.phase >= 0 && P.style !== 'hawaiian' && hzLayer?.kind !== 'lahar');
      renderer.render(scene, camera);
    }
    // Bucle propio (la cámara se puede mover aunque la erupción esté en pausa); se detiene fuera de pantalla.
    let raf = 0, visible = true;
    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; });
    io.observe(el);
    const loop = () => { raf = requestAnimationFrame(loop); if (visible && !document.hidden) draw(); };
    loop();
    // Cuando cambian los datos de la ceniza.
    const offAsh = subscribeAsh((local, n) => { paintAsh(local, n); dirty = true; });
    const offHz = subscribeHazard((h) => { hzLayer = h; hzShown = -1; dirty = true; });
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose(); offAsh(); offHz();
      labelBox?.replaceChildren();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()); });
      [tex, ashTex, tex2, hzTex].forEach((x) => x?.dispose());
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [p.demUrl, p.style, p.phases, p.slots]);

  // La grilla de ceniza llega después (worker): se avisa a la escena sin rehacerla.
  useEffect(() => { ashListeners.forEach((fn) => fn(p.local, p.localN)); }, [p.local, p.localN]);
  useEffect(() => { hazardListeners.forEach((fn) => fn(p.hazard)); }, [p.hazard]);

  return (
    <div ref={wrap} className="vs-3d">
      <div ref={labelsRef} className="vs-labels" aria-hidden="true" />
    </div>
  );
}

const ashListeners = new Set<(local: Float32Array | null, n: number) => void>();
function subscribeAsh(fn: (local: Float32Array | null, n: number) => void) { ashListeners.add(fn); return () => { ashListeners.delete(fn); }; }

const hazardListeners = new Set<(h: HazardLayer | null) => void>();
function subscribeHazard(fn: (h: HazardLayer | null) => void) { hazardListeners.add(fn); return () => { hazardListeners.delete(fn); }; }
