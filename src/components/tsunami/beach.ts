/*
 * Perfil de una costa baja con el nivel del agua (Canvas 2D): mar a la izquierda (fondo con pendiente),
 * orilla y tierra con pendiente suave, casas de madera y de hormigón con la marca del agua. Alturas reales,
 * ancho comprimido. Lo usan el panel de la costa y la versión 2D de la película.
 */
const r0 = (n: number) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;
const HOUSES = Array.from({ length: 7 }, (_, i) => ({ x: 0.18 + i * 0.11 + r0(i) * 0.03, w: 0.045 + r0(i + 9) * 0.02, hh: 3 + r0(i + 3) * (i % 3 === 0 ? 6 : 2.5), concrete: i % 3 === 0 }));

/** `level`: nivel del agua en la orilla (m); `yMax`: escala vertical (m); `time`: para la ondulación; `label`: rótulo arriba. */
export function drawBeach(ctx: CanvasRenderingContext2D, W: number, H: number, level: number, yMax: number, time: number, label: string) {
  const top = Math.max(yMax, 12) + 4, bottom = -Math.max(4, yMax * 0.5);
  const Y = (m: number) => ((top - m) / (top - bottom)) * H;
  const shoreX = 0.32 * W;
  const ground = (x: number) => (x < shoreX ? -((shoreX - x) / shoreX) * (-bottom) * 0.9 : ((x - shoreX) / (W - shoreX)) * Math.min(top - 2, 30));
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#cfe3f0'); sky.addColorStop(1, '#eef3f4');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
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
  // Casas con la marca del agua.
  for (const hs of HOUSES) {
    const x = hs.x * W + shoreX * 0.4, g = ground(x), wpx = hs.w * W;
    ctx.fillStyle = hs.concrete ? '#b8b8b2' : '#d9c8a4';
    ctx.fillRect(x, Y(g + hs.hh), wpx, Y(g) - Y(g + hs.hh));
    ctx.fillStyle = hs.concrete ? '#8f8f8a' : '#9c4a2f';
    if (!hs.concrete) { ctx.beginPath(); ctx.moveTo(x - 2, Y(g + hs.hh)); ctx.lineTo(x + wpx / 2, Y(g + hs.hh + 1.6)); ctx.lineTo(x + wpx + 2, Y(g + hs.hh)); ctx.closePath(); ctx.fill(); }
    if (level - g > 0) { ctx.fillStyle = 'rgba(46,112,160,.55)'; ctx.fillRect(x, Y(Math.min(level, g + hs.hh)), wpx, Y(g) - Y(Math.min(level, g + hs.hh))); }
  }
  ctx.font = '600 13px var(--font-isans), system-ui, sans-serif'; ctx.fillStyle = '#141414'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(label, 10, 8);
  ctx.strokeStyle = 'rgba(20,20,20,.35)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke(); ctx.setLineDash([]);
}
