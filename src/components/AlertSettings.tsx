'use client';
/*
 * Panel de la campanita: avisos con la página cerrada (notificaciones push), qué tipos de eventos y si solo
 * cerca de un lugar, e instalar la página como app. La suscripción vive en el navegador; el servidor guarda
 * solo lo necesario para mandarle avisos (ver /api/push/subscribe).
 */
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PREFS, PUSH_KINDS, PUSH_RADII, type AlertKind, type PushPrefs } from '@/lib/push';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';
import { INSTALL_EVENT, clearInstall, getInstall } from './Pwa';

const T = {
  es: {
    title: 'Avisos', closed: 'Avisarme aunque tenga la página cerrada', on: 'Activados en este dispositivo', off: 'Desactivar',
    kinds: { eq: 'Sismos fuertes', tsunami: 'Tsunamis', storm: 'Ciclones', ash: 'Ceniza volcánica' } as Record<AlertKind, string>,
    rules: 'Sismos de magnitud 6 o más en el mundo y de 5 o más en la Argentina, Chile y la región; mensajes de tsunami de la NOAA; ciclones con nombre; nubes de ceniza de 10 km o más (o cualquiera sobre la Argentina y Chile).',
    where: 'Dónde', world: 'En todo el mundo', near: 'Solo cerca de mí', radius: (km: string) => `a menos de ${km} km`, locate: 'Usar mi ubicación', locating: 'Buscando…',
    nearOf: (n: string) => `Cerca de ${n}`, myLoc: 'tu ubicación', locNote: 'Tu ubicación se guarda redondeada a ~10 km, solo para filtrar los avisos.',
    save: 'Guardar', saved: 'Guardado', working: 'Activando…', activate: 'Activar avisos',
    denied: 'El navegador bloqueó las notificaciones. Podés habilitarlas en la configuración del sitio.', unsupported: 'Este navegador no permite notificaciones con la página cerrada.',
    ios: 'En iPhone y iPad: primero agregá esta página a la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí.',
    failed: 'No se pudo activar. Probá de nuevo en un rato.', install: 'Instalar como app', close: 'Cerrar',
    privacy: 'No pedimos tu nombre ni tu correo. Podés desactivarlo cuando quieras.',
  },
  en: {
    title: 'Alerts', closed: 'Alert me even with the page closed', on: 'On for this device', off: 'Turn off',
    kinds: { eq: 'Strong earthquakes', tsunami: 'Tsunamis', storm: 'Cyclones', ash: 'Volcanic ash' },
    rules: 'Earthquakes of magnitude 6+ worldwide and 5+ in Argentina, Chile and the region; NOAA tsunami messages; named cyclones; ash clouds of 10 km or more (or any over Argentina and Chile).',
    where: 'Where', world: 'Worldwide', near: 'Only near me', radius: (km: string) => `within ${km} km`, locate: 'Use my location', locating: 'Locating…',
    nearOf: (n: string) => `Near ${n}`, myLoc: 'your location', locNote: 'Your location is stored rounded to ~10 km, only to filter alerts.',
    save: 'Save', saved: 'Saved', working: 'Turning on…', activate: 'Turn on alerts',
    denied: 'The browser blocked notifications. You can allow them in the site settings.', unsupported: 'This browser does not support notifications with the page closed.',
    ios: 'On iPhone and iPad: first add this page to your Home Screen (Share → Add to Home Screen) and open it from there.',
    failed: 'It could not be turned on. Try again in a while.', install: 'Install as an app', close: 'Close',
    privacy: 'We do not ask for your name or email. You can turn it off any time.',
  },
};

const KEY = 'atlas-push';
type Stored = { endpoint: string; prefs: PushPrefs };
const readStored = (): Stored | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const writeStored = (s: Stored | null) => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } window.dispatchEvent(new Event(KEY)); };

/** ¿Hay avisos push activos en este navegador? (para no duplicar la notificación de la pestaña abierta). */
export const pushOn = () => !!readStored();

const b64ToBytes = (s: string) => { const p = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(p); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIos = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const standalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export function usePushState() {
  const [s, setS] = useState<Stored | null>(null);
  useEffect(() => { const sync = () => setS(readStored()); sync(); window.addEventListener(KEY, sync); return () => window.removeEventListener(KEY, sync); }, []);
  return s;
}

export function AlertSettings({ lang, onClose, tabToggle }: { lang: Lang; onClose: () => void; tabToggle?: React.ReactNode }) {
  const t = T[lang], nf = (x: number) => fmtNum(lang, x);
  const stored = usePushState();
  const [prefs, setPrefs] = useState<PushPrefs>(DEFAULT_PREFS);
  const [state, setState] = useState<'idle' | 'working' | 'saved' | 'denied' | 'failed'>('idle');
  const [loc, setLoc] = useState<'idle' | 'busy'>('idle');
  const [install, setInstall] = useState(getInstall);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (stored) setPrefs(stored.prefs); }, [stored]);
  useEffect(() => {
    const onInstall = () => setInstall(getInstall());
    window.addEventListener(INSTALL_EVENT, onInstall);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    window.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener(INSTALL_EVENT, onInstall); window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [onClose]);

  const subscribe = async (p: PushPrefs, welcome: boolean) => {
    setState('working');
    try {
      const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (perm !== 'granted') { setState('denied'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const { key } = await (await fetch('/api/push/key')).json();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      const json = sub.toJSON();
      const r = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: { endpoint: json.endpoint, keys: json.keys }, lang, prefs: p, welcome }) });
      if (!r.ok) throw new Error(String(r.status));
      const saved = (await r.json()).prefs as PushPrefs;
      writeStored({ endpoint: json.endpoint!, prefs: saved });
      setState('saved');
    } catch { setState('failed'); }
  };
  const unsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? stored?.endpoint;
      await sub?.unsubscribe();
      if (endpoint) await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }) });
    } catch { /* igual se borra localmente */ }
    writeStored(null); setState('idle');
  };
  const locate = () => {
    setLoc('busy');
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setLoc('idle'); setPrefs((p) => ({ ...p, near: { lat: Math.round(pos.coords.latitude * 10) / 10, lon: Math.round(pos.coords.longitude * 10) / 10, km: p.near?.km ?? 1000, name: '' } })); },
      () => setLoc('idle'), { timeout: 15000, maximumAge: 600000 },
    );
  };
  const toggleKind = (k: AlertKind) => setPrefs((p) => ({ ...p, kinds: p.kinds.includes(k) ? p.kinds.filter((x) => x !== k) : [...p.kinds, k] }));

  const canPush = supported(), iosBrowser = isIos() && !standalone();
  return (
    <div ref={box} className="as" role="dialog" aria-label={t.title}>
      <div className="as-head"><b>{t.title}</b><button type="button" className="as-x" aria-label={t.close} onClick={onClose}>×</button></div>
      {!canPush ? <>{tabToggle}<p className="as-note">{iosBrowser ? t.ios : t.unsupported}</p></> : (
        <>
          <p className="as-sub">{t.closed}</p>
          <fieldset className="as-kinds">
            {PUSH_KINDS.map((k) => <label key={k}><input type="checkbox" checked={prefs.kinds.includes(k)} onChange={() => toggleKind(k)} /> {t.kinds[k]}</label>)}
          </fieldset>
          <fieldset className="as-where">
            <legend>{t.where}</legend>
            <label><input type="radio" name="as-where" checked={!prefs.near} onChange={() => setPrefs((p) => ({ ...p, near: null }))} /> {t.world}</label>
            <label><input type="radio" name="as-where" checked={!!prefs.near} onChange={() => (prefs.near ? null : locate())} /> {t.near}</label>
            {prefs.near && (
              <div className="as-near">
                <select value={prefs.near.km} onChange={(e) => setPrefs((p) => ({ ...p, near: p.near && { ...p.near, km: +e.target.value } }))}>
                  {PUSH_RADII.map((r) => <option key={r} value={r}>{t.radius(nf(r))}</option>)}
                </select>
                <span>{t.nearOf(prefs.near.name || t.myLoc)}</span>
              </div>
            )}
            {loc === 'busy' && <span className="as-note">{t.locating}</span>}
            {prefs.near && <span className="as-note">{t.locNote}</span>}
          </fieldset>
          <div className="as-actions">
            <button type="button" className="ed-button" disabled={state === 'working' || !prefs.kinds.length} onClick={() => subscribe(prefs, !stored)}>
              {state === 'working' ? t.working : stored ? t.save : `🔔 ${t.activate}`}
            </button>
            {stored && <button type="button" className="ml-share" onClick={unsubscribe}>{t.off}</button>}
          </div>
          {stored && state !== 'working' && <p className="as-ok">{state === 'saved' ? t.saved : t.on}</p>}
          {state === 'denied' && <p className="as-note">{t.denied}</p>}
          {state === 'failed' && <p className="as-note">{t.failed}</p>}
          <p className="as-note">{t.rules}</p>
          <p className="as-note">{t.privacy}</p>
        </>
      )}
      {install && <button type="button" className="ml-share" onClick={() => { install.prompt().catch(() => {}); clearInstall(); }}>⬇ {t.install}</button>}
    </div>
  );
}
