import 'server-only';
import webpush from 'web-push';
import { allPushSubs, deletePushSub, kvDeleteOlder, kvGet, kvIncr, kvSet, markPushOk, tryLock, unlock, type PushRow } from './db';
import { getLiveAlerts } from './liveAlerts';
import { alertTexts } from '../alertText';
import { cleanPrefs, wants } from '../push';
import type { LiveAlert } from '../alerts';
import type { Lang } from '../types';

/*
 * Notificaciones push (Web Push con VAPID) para avisar aunque la página esté cerrada.
 * Las claves VAPID salen de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY o, si no están, se generan una vez y se guardan
 * en la base (la clave privada nunca sale del servidor). El envío corre como mucho una vez por minuto: lo
 * disparan /api/alerts (cada visitante con la página abierta) y /api/push/run (tarea programada).
 * Cada aviso se manda una sola vez; en la primera corrida se marcan como enviados los que ya existían.
 */

const SUBJECT = 'https://desastres-naturales-rho.vercel.app';
const FRESH_MS = 6 * 36e5;

type Keys = { publicKey: string; privateKey: string };

export async function vapidKeys(): Promise<Keys> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  const hit = await kvGet<Keys>('push:vapid');
  if (hit) return hit.value;
  // Una sola instancia genera las claves; las demás esperan y las leen.
  if (await tryLock('push:vapid-gen', 30_000)) {
    try {
      const again = await kvGet<Keys>('push:vapid');
      if (again) return again.value;
      const k = webpush.generateVAPIDKeys();
      await kvSet('push:vapid', k);
      return k;
    } finally { await unlock('push:vapid-gen').catch(() => {}); }
  }
  await new Promise((r) => setTimeout(r, 1500));
  const later = await kvGet<Keys>('push:vapid');
  if (!later) throw new Error('VAPID: sin claves');
  return later.value;
}

const payload = (lang: Lang, a: LiveAlert) => {
  const x = alertTexts(lang, a);
  return JSON.stringify({ title: x.title, body: [x.place, x.extra].filter(Boolean).join(' · '), url: x.href, tag: a.id, urgent: a.kind === 'tsunami' && a.level === 'warning' });
};

/** Manda un mensaje a una suscripción; si el navegador ya no existe (404/410), la borra. */
async function send(sub: PushRow, body: string, keys: Keys): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, {
      TTL: 3 * 3600, urgency: 'high', vapidDetails: { subject: SUBJECT, publicKey: keys.publicKey, privateKey: keys.privateKey },
    });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await deletePushSub(sub.endpoint).catch(() => {});
    else console.warn('[push] envío', code ?? '', e instanceof Error ? e.message.slice(0, 120) : e);
    return false;
  }
}

/** Mensaje de confirmación al suscribirse (sirve además para comprobar que funciona). */
export async function sendWelcome(sub: PushRow) {
  const es = sub.lang === 'es';
  const body = JSON.stringify({
    title: es ? 'Avisos activados' : 'Alerts turned on',
    body: es ? 'Te vamos a avisar de sismos fuertes, tsunamis, ciclones y ceniza volcánica aunque tengas la página cerrada.' : 'We will alert you of strong earthquakes, tsunamis, cyclones and volcanic ash even with the page closed.',
    url: `/${sub.lang}`, tag: 'welcome',
  });
  return send(sub, body, await vapidKeys());
}

/** Manda los avisos nuevos a quienes corresponda. Devuelve un resumen. */
export async function dispatchPush(given?: LiveAlert[]) {
  const last = await kvGet<number>('push:lastRun').catch(() => null);
  if (last && Date.now() - last.value < 50_000) return { skipped: 'recent' as const };
  if (!(await tryLock('push:lock', 55_000))) return { skipped: 'locked' as const };
  try {
    await kvSet('push:lastRun', Date.now());
    const alerts = given ?? (await getLiveAlerts());
    const init = await kvGet<number>('push:init');
    const fresh: LiveAlert[] = [];
    for (const a of alerts) {
      const n = await kvIncr(`push:sent:${a.id}`);
      if (n === 1 && init && Date.now() - a.time < FRESH_MS) fresh.push(a);
    }
    if (!init) await kvSet('push:init', Date.now());
    kvDeleteOlder('push:sent:', Date.now() - 7 * 864e5).catch(() => {});
    if (!fresh.length) return { alerts: alerts.length, fresh: 0, sent: 0 };
    const [subs, keys] = await Promise.all([allPushSubs(), vapidKeys()]);
    const jobs: { sub: PushRow; body: string }[] = [];
    for (const sub of subs) {
      const prefs = cleanPrefs(sub.prefs);
      for (const a of fresh) if (wants(prefs, a)) jobs.push({ sub, body: payload(sub.lang, a) });
    }
    const ok: string[] = [];
    for (let i = 0; i < jobs.length; i += 25) {
      const r = await Promise.all(jobs.slice(i, i + 25).map((j) => send(j.sub, j.body, keys)));
      r.forEach((x, k) => { if (x) ok.push(jobs[i + k].sub.endpoint); });
    }
    await markPushOk([...new Set(ok)]).catch(() => {});
    return { alerts: alerts.length, fresh: fresh.length, subs: subs.length, sent: ok.length, failed: jobs.length - ok.length };
  } finally {
    await unlock('push:lock').catch(() => {});
  }
}
