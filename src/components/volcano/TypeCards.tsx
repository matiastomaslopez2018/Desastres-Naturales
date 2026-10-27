/* Tipos de volcán: silueta esquemática (corte), descripción y ejemplos; los que están en el simulador se pueden abrir. */
import type { Lang } from '@/lib/types';
import type { VolcanoType } from '@/lib/volcano/presets';
import { VOLC_TEXT } from '@/lib/volcano/text';

const ORDER: VolcanoType[] = ['shield', 'strato', 'cone', 'dome', 'caldera'];

/** Corte esquemático (sin escala): relieve, magma y, según el tipo, capas, coladas o lago. */
function Silhouette({ type }: { type: VolcanoType }) {
  const ground = '#8a7a66', layer = '#a89680', magma = '#d9480f';
  const shapes: Record<VolcanoType, React.ReactNode> = {
    shield: (<>
      <path d="M0 70 C40 66 70 50 100 44 C130 50 160 66 200 70 Z" fill={ground} />
      <path d="M30 70 C60 62 80 52 100 47 C120 52 140 62 170 70" fill="none" stroke={layer} strokeWidth="2" />
      <path d="M98 70 L98 46 L102 46 L102 70 Z" fill={magma} />
      <path d="M100 44 C112 50 130 58 150 64" fill="none" stroke={magma} strokeWidth="2.5" />
    </>),
    strato: (<>
      <path d="M20 70 L88 16 L94 13 L106 13 L112 16 L180 70 Z" fill={ground} />
      {[26, 38, 50].map((y, i) => <path key={i} d={`M${100 - (y - 8) * 1.3} ${y} L${100 + (y - 8) * 1.3} ${y}`} stroke={layer} strokeWidth="2" />)}
      <path d="M98 70 L98 15 L102 15 L102 70 Z" fill={magma} />
      <path d="M100 13 C96 6 104 2 100 -4" fill="none" stroke="#9a948c" strokeWidth="5" strokeLinecap="round" opacity=".8" />
    </>),
    cone: (<>
      <path d="M0 70 L200 70" stroke={ground} strokeWidth="2" />
      <path d="M62 70 L90 38 L96 42 L104 42 L110 38 L138 70 Z" fill="#5d4b3e" />
      <path d="M98 70 L98 42 L102 42 L102 70 Z" fill={magma} />
      {[[86, 22], [108, 18], [97, 12], [118, 28]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill={magma} />)}
    </>),
    dome: (<>
      <path d="M0 70 C50 70 60 54 70 54 L130 54 C140 54 150 70 200 70 Z" fill={ground} />
      <path d="M76 54 C78 30 122 30 124 54 Z" fill="#6b5a4c" />
      <path d="M84 50 C88 38 112 38 116 50" fill="none" stroke="#4d4038" strokeWidth="2" />
      <path d="M98 70 L98 52 L102 52 L102 70 Z" fill={magma} />
    </>),
    caldera: (<>
      <path d="M0 70 L0 40 L40 26 L60 40 L60 48 L140 48 L140 40 L160 26 L200 40 L200 70 Z" fill={ground} />
      <path d="M62 47 L138 47 L138 50 L62 50 Z" fill="#4f86b0" />
      <path d="M60 50 L140 50 L130 70 L70 70 Z" fill="#7a6a58" />
      <path d="M96 70 L96 52 L104 52 L104 70 Z" fill={magma} opacity=".6" />
    </>),
  };
  return <svg viewBox="0 -8 200 80" className="vs-type-svg" aria-hidden="true">{shapes[type]}</svg>;
}

export function TypeCards({ lang, current, onPick }: { lang: Lang; current: VolcanoType | null; onPick: (t: VolcanoType) => void }) {
  const t = VOLC_TEXT[lang];
  return (
    <section className="vs-types" aria-label={t.types}>
      <h2 className="qs-h">{t.types}</h2>
      <p className="qs-help">{t.typesHelp}</p>
      <div className="vs-type-grid">
        {ORDER.map((k) => (
          <button key={k} type="button" className="vs-type" aria-pressed={current === k} onClick={() => onPick(k)}>
            <Silhouette type={k} />
            <span className="vs-type-name">{t.typeNames[k]}</span>
            <span className="vs-type-text">{t.typeText[k]}</span>
            <span className="vs-type-ex">{t.typeExamples[k]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
