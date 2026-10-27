import { NextResponse } from 'next/server';
import { deletePushSub, savePushSub } from '@/lib/server/db';
import { sendWelcome } from '@/lib/server/push';
import { cleanPrefs } from '@/lib/push';

export const dynamic = 'force-dynamic';

/*
 * POST   { sub: { endpoint, keys: { p256dh, auth } }, lang, prefs }  → guarda (o actualiza) la suscripción.
 *        Con `welcome: true` manda un mensaje de confirmación.
 * DELETE { endpoint }                                                  → la borra.
 * Se guarda solo lo que el navegador entrega para poder mandarle avisos, el idioma y las preferencias.
 */

const okEndpoint = (e: unknown): e is string => typeof e === 'string' && e.length < 1000 && /^https:\/\//.test(e);
const okKey = (k: unknown) => typeof k === 'string' && k.length > 10 && k.length < 300 && /^[A-Za-z0-9_-]+=*$/.test(k);

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { sub?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; lang?: string; prefs?: unknown; welcome?: boolean } | null;
  const s = b?.sub;
  if (!s || !okEndpoint(s.endpoint) || !okKey(s.keys?.p256dh) || !okKey(s.keys?.auth)) return NextResponse.json({ error: 'bad' }, { status: 400 });
  const row = { endpoint: s.endpoint, keys: { p256dh: String(s.keys!.p256dh), auth: String(s.keys!.auth) }, lang: b?.lang === 'en' ? 'en' as const : 'es' as const, prefs: cleanPrefs(b?.prefs) };
  await savePushSub(row);
  const delivered = b?.welcome ? await sendWelcome(row) : null;
  return NextResponse.json({ ok: true, prefs: row.prefs, delivered });
}

export async function DELETE(req: Request) {
  const b = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!okEndpoint(b?.endpoint)) return NextResponse.json({ error: 'bad' }, { status: 400 });
  await deletePushSub(b.endpoint);
  return NextResponse.json({ ok: true });
}
