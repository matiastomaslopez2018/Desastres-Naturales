import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { kvGet, kvIncr, kvSet } from './db';

/*
 * Traducción automática (opcional) de textos oficiales en inglés, como el "Tectonic Summary"
 * de USGS. Solo si existe ANTHROPIC_API_KEY. Cada texto se traduce una sola vez y queda
 * guardado en la base (Turso) sin vencimiento; hay un tope de traducciones nuevas por mes.
 * La ficha la rotula "Traducción automática" y deja ver siempre el original.
 */

const MODEL = 'claude-opus-5-5';
/** Tope de traducciones nuevas por mes calendario (UTC). Las ya guardadas no cuentan. */
export const MONTHLY_LIMIT = 200;
/** Si una traducción falla, no se reintenta hasta pasado este tiempo (para no gastar el cupo). */
const RETRY_MS = 24 * 36e5;

export const canTranslate = () => !!process.env.ANTHROPIC_API_KEY?.trim();
const pending = new Map<string, Promise<string[] | null>>();

export async function translateParagraphs(key: string, paras: string[]): Promise<string[] | null> {
  if (!paras.length) return null;
  const k = `tr2:es:${key}`;
  // Ya traducido: se devuelve aunque después se quite la clave o se agote el cupo.
  const hit = await kvGet<string[]>(k).catch(() => null) ?? await kvGet<string[]>(`tr1:es:${key}`).catch(() => null);
  if (hit && Array.isArray(hit.value) && hit.value.length === paras.length) return hit.value;
  if (!canTranslate()) return null;
  let p = pending.get(k);
  if (!p) {
    p = translateOnce(k, paras).finally(() => pending.delete(k));
    pending.set(k, p);
  }
  return p;
}

async function translateOnce(k: string, paras: string[]): Promise<string[] | null> {
  try {
    const failed = await kvGet<number>(`${k}:fail`).catch(() => null);
    if (failed && Date.now() - failed.value < RETRY_MS) return null;
    // Cupo del mes: se reserva antes de llamar a la API (el contador es atómico en la base).
    const used = await kvIncr(`tr2:count:${new Date().toISOString().slice(0, 7)}`);
    if (used > MONTHLY_LIMIT) return null;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      system:
        'Traducí al español rioplatense neutro (sin voseo marcado) este texto científico del USGS. ' +
        'Conservá cifras, unidades, nombres propios y siglas tal cual; no agregues ni quites información. ' +
        'Devolvé solo la traducción, un párrafo por línea, en el mismo orden y con la misma cantidad de párrafos.',
      messages: [{ role: 'user', content: paras.join('\n') }],
    });
    if (response.stop_reason === 'refusal') throw new Error('refusal');
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    const out = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (out.length !== paras.length) throw new Error(`párrafos: ${out.length} ≠ ${paras.length}`);
    await kvSet(k, out);
    return out;
  } catch (err) {
    console.error('[translate]', err instanceof Error ? err.message : err);
    await kvSet(`${k}:fail`, Date.now()).catch(() => {});
    return null;
  }
}
