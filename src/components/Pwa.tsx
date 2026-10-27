'use client';
/*
 * App instalable: registra el service worker (en producción, o si ya hay avisos push activos) y guarda el
 * ofrecimiento de instalación del navegador para mostrar el botón "Instalar como app" cuando se abra el panel.
 */
import { useEffect } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void> };
let installEvent: InstallEvent | null = null;
export const INSTALL_EVENT = 'atlas-install';
export const getInstall = () => installEvent;
export const clearInstall = () => { installEvent = null; window.dispatchEvent(new Event(INSTALL_EVENT)); };

export function Pwa() {
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); installEvent = e as InstallEvent; window.dispatchEvent(new Event(INSTALL_EVENT)); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    let push = false;
    try { push = !!localStorage.getItem('atlas-push'); } catch { /* sin almacenamiento */ }
    if ('serviceWorker' in navigator && (process.env.NODE_ENV === 'production' || push)) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  return null;
}
