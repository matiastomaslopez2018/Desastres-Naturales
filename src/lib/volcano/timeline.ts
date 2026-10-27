/*
 * Línea de tiempo de la animación: las fases de la erupción se reparten los segundos de animación
 * (proporcional a la raíz de su duración, así una fase corta igual se ve) con una pausa corta entre fases.
 */
export const ANIM_S = 24;
const GAP_S = 1.5;

export type Slot = { start: number; end: number; hours: number; startMs: number };

export function slots(phases: { hours: number; start: string }[]): Slot[] {
  const weights = phases.map((p) => Math.sqrt(Math.max(p.hours, 0.05)));
  const sum = weights.reduce((a, b) => a + b, 0), avail = ANIM_S - GAP_S * (phases.length - 1);
  let t = 0;
  return phases.map((p, i) => {
    const d = (avail * weights[i]) / sum, s = { start: t, end: t + d, hours: p.hours, startMs: Date.parse(p.start.replace(/^00(\d\d)/, '20$1')) };
    t += d + GAP_S;
    return s;
  });
}

/** Estado en el segundo `t` de la animación: fase activa (o −1 en una pausa), avance dentro de la fase y masa caída (0–1). */
export function at(ss: Slot[], masses: number[], t: number) {
  const total = masses.reduce((a, b) => a + b, 0) || 1;
  let done = 0;
  for (let i = 0; i < ss.length; i++) {
    const s = ss[i];
    if (t < s.start) return { phase: -1, frac: 0, deposited: done / total, realS: 0, last: i - 1 };
    if (t <= s.end) {
      const frac = (t - s.start) / (s.end - s.start);
      return { phase: i, frac, deposited: (done + masses[i] * frac) / total, realS: frac * s.hours * 3600, last: i };
    }
    done += masses[i];
  }
  return { phase: -1, frac: 1, deposited: 1, realS: 0, last: ss.length - 1 };
}
