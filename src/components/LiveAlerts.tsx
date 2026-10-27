'use client';
/*
 * Avisos en vivo: mientras la página está abierta se consulta /api/alerts cada minuto y, si aparece un
 * evento nuevo (sismo fuerte, aviso de tsunami, ciclón o nube de ceniza volcánica), sale una tarjeta abajo a la derecha. Quien lo
 * active recibe además una notificación del navegador, que se ve aunque esté en otra pestaña.
 *
 * Lo ya avisado se recuerda en este navegador (localStorage) para no repetirlo al recargar o cambiar de
 * página. Al entrar solo se avisa lo de los últimos 15 minutos (y ningún ciclón que ya estuviera activo).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { LiveAlert } from '@/lib/alerts';
import { fmtRel } from '@/lib/format';
import { alertTexts as texts } from '@/lib/alertText';
import { routePath } from '@/lib/seo';
import { AlertSettings, pushOn, usePushState } from './AlertSettings';
import type { Lang } from '@/lib/types';

/** Sección de "Qué hacer" para cada tipo de aviso. */
const GUIDE_ANCHOR: Record<Lang, Record<LiveAlert['kind'], string>> = {
  es: { eq: 'sismo', tsunami: 'tsunami', storm: 'huracan', ash: 'volcan' },
  en: { eq: 'earthquake', tsunami: 'tsunami', storm: 'hurricane', ash: 'volcano' },
};

const POLL_MS = 60_000, FRESH_MS = 15 * 60_000, KEEP_MS = 3 * 24 * 3600_000, MAX_SHOWN = 3;
const SEEN_KEY = 'atlas-alerts-seen', NOTIFY_KEY = 'atlas-alerts-notify';

const T = {
  es: {
    see: 'Ver detalles', todo: 'Qué hacer', close: 'Cerrar aviso', region: 'Avisos de eventos',
    notifyAsk: 'Avisarme aunque esté en otra pestaña', bell: 'Avisarme de sismos fuertes, tsunamis, ciclones y ceniza volcánica aunque esté en otra pestaña', notifyOn: 'Notificaciones activadas', notifyOff: 'Desactivar notificaciones', denied: 'El navegador bloqueó las notificaciones.',
    src: { eq: 'USGS', tsunami: 'NOAA', storm: 'NHC / GDACS', ash: 'NOAA (SIGMET)' },
  },
  en: {
    see: 'See details', todo: 'What to do', close: 'Close alert', region: 'Event alerts',
    notifyAsk: 'Alert me even in another tab', bell: 'Alert me of strong earthquakes, tsunamis, cyclones and volcanic ash even in another tab', notifyOn: 'Notifications on', notifyOff: 'Turn notifications off', denied: 'The browser blocked notifications.',
    src: { eq: 'USGS', tsunami: 'NOAA', storm: 'NHC / GDACS', ash: 'NOAA (SIGMET)' },
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

export function LiveAlerts({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [shown, setShown] = useState<LiveAlert[]>([]);
  const notify = useNotify();
  const [denied, setDenied] = useState(false);
  const [, tick] = useState(0);

  const announce = useCallback((fresh: LiveAlert[]) => {
    if (!fresh.length) return;
    setShown((s) => [...fresh, ...s.filter((x) => !fresh.some((f) => f.id === x.id))].slice(0, MAX_SHOWN));
    // Con avisos push activos, la notificación llega por ahí (con la misma etiqueta): no se repite acá.
    if (notifyOn() && !pushOn()) {
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
              <p className="la-links">
                <Link className="la-link" href={x.href} onClick={() => setShown((s) => s.filter((y) => y.id !== a.id))}>{t.see} →</Link>
                <Link className="la-link" href={`${routePath(lang, 'whatToDo')}#${GUIDE_ANCHOR[lang][a.kind]}`}>{t.todo} →</Link>
              </p>
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

/** Campanita del encabezado: abre el panel de avisos (con la página cerrada, tipos y lugar) e instalar como app. */
export function AlertsBell({ lang }: { lang: Lang }) {
  const t = T[lang];
  const tab = useNotify(), push = usePushState();
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState(false);
  const on = tab || !!push;
  const label = on ? t.notifyOn : t.bell;
  // Si el navegador no permite push pero sí notificaciones, queda la opción de la pestaña abierta.
  const tabToggle = supported() ? (
    <p className="as-sub">{denied ? t.denied : tab ? <>{t.notifyOn} · <button type="button" className="as-link" onClick={() => writeNotify(false)}>{t.notifyOff}</button></> : <button type="button" className="as-link" onClick={async () => { if (!(await enableNotify())) setDenied(true); }}>🔔 {t.notifyAsk}</button>}</p>
  ) : null;
  return (
    <span className="la-bell-wrap">
      <button type="button" className={`la-bell${on ? ' on' : ''}`} aria-expanded={open} aria-haspopup="dialog" title={label} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v3.6L4.3 16h15.4L18 12.6V9a6 6 0 0 0-6-6Zm-2.2 15a2.3 2.3 0 0 0 4.4 0" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
      </button>
      {open && <AlertSettings lang={lang} onClose={() => setOpen(false)} tabToggle={tabToggle} />}
    </span>
  );
}
