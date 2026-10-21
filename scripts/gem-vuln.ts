/*
 * Extrae del Modelo Global de Vulnerabilidad de GEM (github.com/gem/global_vulnerability_model, CC BY-NC-SA 4.0)
 * las funciones de vulnerabilidad estructural de Argentina para las construcciones de la ciudad del
 * simulador, y genera src/lib/quake/vulnerability.ts (sin editar valores a mano).
 *   npx tsx scripts/gem-vuln.ts
 */
import { writeFileSync } from 'node:fs';

const URL_XML = 'https://raw.githubusercontent.com/gem/global_vulnerability_model/HEAD/South_America/Argentina/vulnerability_structural.xml';

/** Clases elegidas (taxonomía GEM) en el orden en que aparecen en la cuadra. */
const IDS = [
  'MUR+ADO/LWAL/CDN+ERN/H:1/RES',
  'MUR+CLBRH/LWAL/CDN+ERN/H:2/RES',
  'W/LFM/CDM+ERM/H:1/RES',
  'MCF/LWAL/CDL+ERL/H:2/RES',
  'CR/LFINF/CDM+ERL/H:7/RES',
  'MCF/LWAL/CDH+ERH/H:3/RES',
  'CR/LWAL/CDM+ERM/H:8/COM',
  'CR/LFINF/CDM+ERL/H:5/RES',
];

async function main() {
  const xml = await (await fetch(URL_XML)).text();
  const nums = (s: string) => s.trim().split(/\s+/).map(Number);
  const out = IDS.map((id) => {
    const i = xml.indexOf(`<vulnerabilityFunction id="${id}"`);
    if (i < 0) throw new Error(`no está ${id}`);
    const block = xml.slice(i, xml.indexOf('</vulnerabilityFunction>', i));
    const imt = /imt="([^"]+)"/.exec(block)![1];
    const imls = nums(/<imls[^>]*>([^<]+)<\/imls>/.exec(block)![1]);
    const mean = nums(/<meanLRs>([^<]+)<\/meanLRs>/.exec(block)![1]);
    const cov = nums(/<covLRs>([^<]+)<\/covLRs>/.exec(block)![1]);
    return { id, imt, imls, mean, cov };
  });
  const ts = `// Generado por scripts/gem-vuln.ts a partir del Modelo Global de Vulnerabilidad de GEM (${new Date().toISOString().slice(0, 10)}).
// Nafeh, Aljawhari y Silva (2025), github.com/gem/global_vulnerability_model, doi:10.5281/zenodo.8391742.
// Licencia CC BY-NC-SA 4.0. Funciones estructurales de Argentina: razón de pérdida (costo de reparación /
// costo de reposición de la estructura) en función de la intensidad, con distribución beta (media y CoV).

export type VulnFunction = { id: string; imt: string; imls: number[]; mean: number[]; cov: number[] };

export const GEM_ARG: VulnFunction[] = ${JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n  {').replace(/^\[/, '[\n  ').replace(/\]$/, ',\n]')};
`;
  writeFileSync('src/lib/quake/vulnerability.ts', ts);
  console.log(out.map((f) => `${f.id} · ${f.imt}`).join('\n'));
}
main();
