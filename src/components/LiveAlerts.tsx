'use client';
/*
 * Avisos en vivo: mientras la página está abierta se consulta /api/alerts cada minuto y, si aparece un
 * evento nuevo (sismo fuerte, aviso de tsunami o ciclón), sale una tarjeta abajo a la derecha. Quien lo
 * active recibe además una notificación del navegador, que se ve aunque esté en otra pestaña.
 *
 * Lo ya avisado se recuerda en este navegador (localStorage) para no repetirlo al recargar o cambiar de
 * página. Al entrar solo se avisa lo de los últimos 15 minutos (y ningún ciclón que ya estuviera activo).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { LiveAlert } from '@/lib/alerts';
import { fmtNum, fmtRel } from '@/lib/format';
import { localPlace } from '@/lib/localize';
import { routePath } from '@/lib/seo';
import type { Lang } from '@/lib/types';

const POLL_MS = 60_000, FRESH_MS = 15 * 60_000, KEEP_MS = 3 * 24 * 3600_000, MAX_SHOWN = 3;
const SEEN_KEY = 'atlas-alerts-seen', NOTIFY_KEY = 'atlas-alerts-notify';

const T = {
  es: {
    eq: (m: string) => `Sismo de magnitud ${m}`, tsunami: 'Mensaje de tsunami', storm: (w: string) => w,
    word: { hurricane: 'Huracán', typhoon: 'Tifón', cyclone: 'Ciclón', storm: 'Tormenta tropical' },
    levels: { warning: 'Alerta de tsunami', advisory: 'Aviso de tsunami', watch: 'Vigilancia de tsunami' } as Record<string, string>,
    oceanic: 'En zona oceánica: revisá los avisos oficiales de tsunami.',
    see: 'Ver detalles', close: 'Cerrar aviso', region: 'Avisos de eventos',
    notifyAsk: 'Avisarme aunque esté en otra pestaña', bell: 'Avisarme de sismos fuertes, tsunamis y ciclones aunque esté en otra pestaña', notifyOn: 'Notificaciones activadas', notifyOff: 'Desactivar notificaciones', denied: 'El navegador bloqueó las notificaciones.',
    src: { eq: 'USGS', tsunami: 'NOAA', storm: 'NHC / GDACS' },
  },
  en: {
    eq: (m: string) => `Magnitude ${m} earthquake`, tsunami: 'Tsunami message', storm: (w: string) => w,
    word: { hurricane: 'Hurricane', typhoon: 'Typhoon', cyclone: 'Cyclone', storm: 'Tropical storm' },
    levels: { warning: 'Tsunami warning', advisory: 'Tsunami advisory', watch: 'Tsunami watch' } as Record<string, string>,
    oceanic: 'Offshore: check the official tsunami messages.',
    see: 'See details', close: 'Close alert', region: 'Event alerts',
    notifyAsk: 'Alert me even in another tab', bell: 'Alert me of strong earthquakes, tsunamis and cyclones even in another tab', notifyOn: 'Notifications on', notifyOff: 'Turn notifications off', denied: 'The browser blocked notifications.',
    src: { eq: 'USGS', tsunami: 'NOAA', storm: 'NHC / GDACS' },
  },
};

/* Almacenamiento local: puede no estar disponible (modo privado, sitio bloqueado); sin él igual funciona. */
const readSeen = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; } };
const writeSeen = (s: Record<string, number>) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ } };
const NOTIFY_EVENT = 'atlas-alerts-notify';
const supported = () => typeof window !== 'undefined' && 'Notification' in window;
/** ¿Están activadas las notificaciones del navegador? (preferencia guardada y permiso concedido). */
const notifyOn = () => { try { return supported() && Notification.permission === 'granted' && localStorage.getItem(NOTIFY_KEY) === '1'; } catch { return false; } };
const writeNotify = (on: boolean) => { try { localStorage.setItem(NOTIFY_KEY, on ? '1' : '0'); } catch { /* sin almacenamiento */ } window.dispatchEvent(new Event(NOTIFY_EVENT)); };
/** Pide permiso (si hace falta) y activa; devuelve si quedaron activadas. */
async function enableNotify() {
  if (!supported()) return false;
  const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  writeNotify(p === 'granted');
  return p === 'granted';
}
/** Estado de las notificaciones, al día con los cambios hechos desde otro componente. */
function useNotify() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(notifyOn());
    sync();
    window.addEventListener(NOTIFY_EVENT, sync);
    return () => window.removeEventListener(NOTIFY_EVENT, sync);
  }, []);
  return on;
}

function texts(lang: Lang, a: LiveAlert) {
  const t = T[lang];
  if (a.kind === 'eq') return { title: t.eq(fmtNum(lang, a.mag ?? 0, 1)), place: localPlace(a.title, lang), extra: a.tsunami ? t.oceanic : null, href: `/${lang}/evento/${encodeURIComponent(a.id)}` };
  if (a.kind === 'tsunami') return { title: (a.level && t.levels[a.level]) || t.tsunami, place: a.title, extra: a.mag ? `M ${fmtNum(lang, a.mag, 1)}` : null, href: routePath(lang, 'tsunami') };
  const strong = /^(HU|TY|STY|MH)/i.test(a.classification ?? '') || (a.windKt ?? 0) >= 64;
  const word = strong ? t.word[a.basinWord ?? 'hurricane'] : t.word.storm;
  return { title: `${word} ${a.title}`, place: a.windKt ? `${fmtNum(lang, a.windKt * 1.852)} km/h` : '', extra: null, href: routePath(lang, 'hurricanes') };
}

export function LiveAlerts({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [shown, setShown] = useState<LiveAlert[]>([]);
  const notify = useNotify();
  const [denied, setDenied] = useState(false);
  const [, tick] = useState(0);

  const announce = useCallback((fresh: LiveAlert[]) => {
    if (!fresh.length) return;
    setShown((s) => [...fresh, ...s.filter((x) => !fresh.some((f) => f.id === x.id))].slice(0, MAX_SHOWN));
    if (notifyOn()) {
      for (const a of fresh) {
        const x = texts(lang, a);
        try {
          const n = new Notification(x.title, { body: [x.place, x.extra].filter(Boolean).join(' · '), tag: a.id, icon: '/icon.svg' });
          n.onclick = () => { window.focus(); window.location.href = x.href; };
        } catch { /* algunos navegadores móviles solo permiten notificaciones desde un service worker */ }
      }
    }
  }, [lang]);

  useEffect(() => {
    let alive = true, first = true;
    const poll = async () => {
      try {
        const r = await fetch('/api/alerts');
        if (!r.ok) return;
        const { alerts } = (await r.json()) as { alerts: LiveAlert[] };
        if (!alive) return;
        const now = Date.now(), seen = readSeen();
        // Los ciclones duran días: al entrar no se avisan los que ya estaban; sí los que se forman con la página abierta.
        const fresh = alerts.filter((a) => !(a.id in seen) && (!first || (a.kind !== 'storm' && now - a.time < FRESH_MS))).sort((a, b) => b.time - a.time);
        for (const a of alerts) seen[a.id] = seen[a.id] ?? now;
        for (const k of Object.keys(seen)) if (now - seen[k] > KEEP_MS) delete seen[k];
        writeSeen(seen);
        first = false;
        announce(fresh);
      } catch { /* sin conexión: se reintenta en el próximo ciclo */ }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    // Refresca los "hace X min" de las tarjetas.
    const clock = setInterval(() => tick((n) => n + 1), 30_000);
    return () => { alive = false; clearInterval(id); clearInterval(clock); };
  }, [announce]);

  const ask = async () => { if (!(await enableNotify())) setDenied(true); };
  const off = () => writeNotify(false);
  const canNotify = supported();

  if (!shown.length) return null;
  return (
    <section className="la" aria-label={t.region}>
      {shown.map((a) => {
        const x = texts(lang, a), urgent = a.kind === 'tsunami' && a.level === 'warning';
        return (
          <div key={a.id} className={`la-card la-${a.kind}`} role={urgent ? 'alert' : 'status'}>
            <span className="la-dot" aria-hidden="true" />
            <div className="la-body">
              <p className="la-title">{x.title}</p>
              {x.place && <p className="la-place">{x.place}</p>}
              <p className="la-meta">{fmtRel(lang, a.time)} · {t.src[a.kind]}</p>
              {x.extra && <p className="la-extra">{x.extra}</p>}
              <Link className="la-link" href={x.href} onClick={() => setShown((s) => s.filter((y) => y.id !== a.id))}>{t.see} →</Link>
            </div>
            <button type="button" className="la-close" aria-label={t.close} onClick={() => setShown((s) => s.filter((y) => y.id !== a.id))}>×</button>
          </div>
        );
      })}
      {canNotify && (
        <p className="la-notify">
          {denied ? t.denied : notify ? <>{t.notifyOn} · <button type="button" onClick={off}>{t.notifyOff}</button></> : <button type="button" onClick={ask}>🔔 {t.notifyAsk}</button>}
        </p>
      )}
    </section>
  );
}

/** Campanita del encabezado: activa o desactiva las notificaciones del navegador para los avisos en vivo. */
export function AlertsBell({ lang }: { lang: Lang }) {
  const t = T[lang];
  const on = useNotify();
  const [ok, setOk] = useState(false);
  const [denied, setDenied] = useState(false);
  useEffect(() => { setOk(supported()); setDenied(supported() && Notification.permission === 'denied'); }, [on]);
  if (!ok) return null;
  const label = denied ? t.denied : on ? `${t.notifyOn}. ${t.notifyOff}` : t.bell;
  return (
    <button type="button" className={`la-bell${on ? ' on' : ''}`} aria-pressed={on} title={label} aria-label={label} disabled={denied}
      onClick={async () => { if (on) writeNotify(false); else if (!(await enableNotify())) setDenied(true); }}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v3.6L4.3 16h15.4L18 12.6V9a6 6 0 0 0-6-6Zm-2.2 15a2.3 2.3 0 0 0 4.4 0" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
    </button>
  );
}
