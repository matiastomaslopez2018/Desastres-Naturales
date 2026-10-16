'use client';

import { useState } from 'react';
import { T } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

/**
 * Compartir una página propia del sitio (evento o país): WhatsApp, X y copiar enlace.
 * `path` es relativo ("/es/evento/us6000u214"); la URL absoluta sale del sitio actual,
 * así funciona igual en producción, en previews y en local.
 */
export function ShareButtons({ lang, path, text }: { lang: Lang; path: string; text: string }) {
  const t = T[lang];
  const [copied, setCopied] = useState(false);
  const url = () => (typeof window === 'undefined' ? path : new URL(path, window.location.origin).toString());
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
    } catch {
      // Sin permiso de portapapeles: selección manual como último recurso.
      window.prompt(t.copyLink, url());
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="share" role="group" aria-label={t.share}>
      <span className="share-label">{t.share}</span>
      <button type="button" className="share-btn" aria-label="WhatsApp" title="WhatsApp"
        onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url()}`)}`)}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.5 11.5 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z" /></svg>
      </button>
      <button type="button" className="share-btn" aria-label="X" title="X"
        onClick={() => open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url())}`)}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.8 2h3.4l-7.4 8.5L22.5 22h-6.8l-5.3-7-6.1 7H.9l7.9-9.1L.5 2h7l4.8 6.4L17.8 2Zm-1.2 18h1.9L6.5 3.9H4.5L16.6 20Z" /></svg>
      </button>
      <button type="button" className="share-btn share-copy" onClick={copy} aria-live="polite">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
        <span>{copied ? t.copied : t.copyLink}</span>
      </button>
    </div>
  );
}
