import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { kvCached } from './kvCache';

/*
 * Traducción automática (opcional) de textos oficiales en inglés, como el "Tectonic Summary"
 * de USGS. Solo si existe ANTHROPIC_API_KEY; la ficha la rotula "Traducción automática" y
 * muestra siempre el original debajo. El resultado se guarda en la base para no repetirlo.
 */

const MODEL = 'claude-opus-5-5';
export const canTranslate = () => !!process.env.ANTHROPIC_API_KEY?.trim();

export async function translateParagraphs(key: string, paras: string[]): Promise<string[] | null> {
  if (!canTranslate() || !paras.length) return null;
  try {
    const r = await kvCached(`tr1:es:${key}`, 365 * 864e5, async () => {
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
      return out;
    });
    return r.value;
  } catch (err) {
    console.error('[translate]', err instanceof Error ? err.message : err);
    return null;
  }
}
