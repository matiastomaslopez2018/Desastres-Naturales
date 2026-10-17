import { FaultDiagram } from '@/components/geology/FaultDiagram';
import { SettingSketch } from '@/components/geology/VolcanoGeology';
import type { Figure } from '@/lib/learn';
import type { Lang } from '@/lib/types';

/* Esquemas simples de los artículos de Aprender (ilustrativos, sin datos). */

const L = {
  es: {
    'fault-reverse': 'Falla inversa: un bloque sube sobre el otro', 'fault-normal': 'Falla normal: un bloque baja', 'fault-ss': 'Falla de rumbo: los bloques se deslizan de costado',
    'volc-subduction': 'Subducción', 'volc-rift': 'Rift o dorsal', 'volc-intraplate': 'Punto caliente',
    saffir: 'Escala Saffir-Simpson (viento sostenido)', 'fire-triangle': 'Triángulo del fuego', 'tsunami-wave': 'En mar abierto la ola es baja y rápida; cerca de la costa se frena y crece',
    risk: 'Riesgo: amenaza, exposición y vulnerabilidad', cone: 'Cono de pronóstico: dónde puede estar el centro (no el tamaño de la tormenta)',
    heat: 'Calor', oxygen: 'Oxígeno', fuel: 'Combustible', hazard: 'Amenaza', exposure: 'Exposición', vulnerability: 'Vulnerabilidad', riskWord: 'Riesgo',
    deep: 'Mar profundo: ~700 km/h', shallow: 'Costa: lenta y alta', center: 'Centro de la tormenta', wind: 'Vientos fuertes', track: 'Trayectoria pronosticada',
  },
  en: {
    'fault-reverse': 'Reverse fault: one block rides up over the other', 'fault-normal': 'Normal fault: one block drops', 'fault-ss': 'Strike-slip fault: blocks slide sideways',
    'volc-subduction': 'Subduction', 'volc-rift': 'Rift or ridge', 'volc-intraplate': 'Hotspot',
    saffir: 'Saffir-Simpson scale (sustained wind)', 'fire-triangle': 'Fire triangle', 'tsunami-wave': 'In the open ocean the wave is low and fast; near the coast it slows and grows',
    risk: 'Risk: hazard, exposure and vulnerability', cone: 'Forecast cone: where the center may be (not the size of the storm)',
    heat: 'Heat', oxygen: 'Oxygen', fuel: 'Fuel', hazard: 'Hazard', exposure: 'Exposure', vulnerability: 'Vulnerability', riskWord: 'Risk',
    deep: 'Deep sea: ~700 km/h', shallow: 'Coast: slow and tall', center: 'Storm center', wind: 'Strong winds', track: 'Forecast track',
  },
};

const SS: [string, string, string][] = [
  ['#5ebaff', 'TD', '< 63'], ['#00faf4', 'TS', '63–118'], ['#ffffcc', '1', '119–153'], ['#ffe775', '2', '154–177'],
  ['#ffc140', '3', '178–208'], ['#ff8f20', '4', '209–251'], ['#ff6060', '5', '≥ 252'],
];

export function LearnFigure({ lang, f }: { lang: Lang; f: Figure }) {
  const t = L[lang];
  let body: React.ReactNode;
  if (f === 'fault-reverse' || f === 'fault-normal' || f === 'fault-ss') {
    body = <FaultDiagram kind={f === 'fault-reverse' ? 'reverse' : f === 'fault-normal' ? 'normal' : 'strike-slip'} label={t[f]} />;
  } else if (f === 'volc-subduction' || f === 'volc-rift' || f === 'volc-intraplate') {
    body = <SettingSketch kind={f === 'volc-subduction' ? 'subduction' : f === 'volc-rift' ? 'rift' : 'intraplate'} label={t[f]} />;
  } else if (f === 'saffir') {
    body = (
      <div className="lf-ss" role="img" aria-label={t.saffir}>
        {SS.map(([c, k, v]) => <span key={k} style={{ background: c }}><strong>{k}</strong>{v} km/h</span>)}
      </div>
    );
  } else if (f === 'fire-triangle') {
    body = (
      <svg viewBox="0 0 240 190" className="lf-svg" role="img" aria-label={t['fire-triangle']}>
        <path d="M120 20 L220 170 L20 170 Z" className="lf-tri" />
        <text x="120" y="12" textAnchor="middle" className="lf-t">{t.heat}</text>
        <text x="228" y="186" textAnchor="end" className="lf-t">{t.oxygen}</text>
        <text x="12" y="186" className="lf-t">{t.fuel}</text>
        <path d="M120 150 C 95 130, 108 108, 116 96 C 118 112, 128 112, 126 92 C 146 112, 150 138, 120 150 Z" className="lf-flame" />
      </svg>
    );
  } else if (f === 'tsunami-wave') {
    body = (
      <svg viewBox="0 0 320 130" className="lf-svg" role="img" aria-label={t['tsunami-wave']}>
        <path d="M0 60 C 30 56, 60 56, 90 60 S 150 64, 180 58 C 220 50, 245 30, 262 40 L 270 60" className="lf-wave" />
        <path d="M0 130 L 0 110 L 190 110 L 280 70 L 320 64 L 320 130 Z" className="lf-ground" />
        <text x="40" y="90" className="lf-t small">{t.deep}</text>
        <text x="196" y="26" className="lf-t small">{t.shallow}</text>
      </svg>
    );
  } else if (f === 'risk') {
    body = (
      <svg viewBox="0 0 300 200" className="lf-svg" role="img" aria-label={t.risk}>
        <circle cx="110" cy="80" r="60" className="lf-c1" /><circle cx="190" cy="80" r="60" className="lf-c2" /><circle cx="150" cy="140" r="60" className="lf-c3" />
        <text x="80" y="60" textAnchor="middle" className="lf-t small">{t.hazard}</text>
        <text x="222" y="60" textAnchor="middle" className="lf-t small">{t.exposure}</text>
        <text x="150" y="185" textAnchor="middle" className="lf-t small">{t.vulnerability}</text>
        <text x="150" y="105" textAnchor="middle" className="lf-t strong">{t.riskWord}</text>
      </svg>
    );
  } else {
    body = (
      <svg viewBox="0 0 320 160" className="lf-svg" role="img" aria-label={t.cone}>
        <path d="M40 120 C 100 115, 160 90, 290 40 L 300 120 C 200 140, 120 135, 40 128 Z" className="lf-cone" />
        <path d="M40 124 C 100 120, 170 100, 295 80" className="lf-track" />
        {[[40, 124], [110, 118], [180, 103], [250, 88]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4" className="lf-pt" />)}
        <circle cx="40" cy="124" r="26" className="lf-wind" />
        <text x="40" y="80" textAnchor="middle" className="lf-t small">{t.wind}</text>
        <text x="200" y="150" className="lf-t small">{t.track}</text>
      </svg>
    );
  }
  return <figure className="lf">{body}<figcaption className="ed-note">{t[f]}</figcaption></figure>;
}
