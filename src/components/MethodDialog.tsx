'use client';

import { useEffect, useRef } from 'react';
import { Corners } from './Corners';
import { METHOD, T } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

export function MethodDialog({ lang, onClose }: { lang: Lang; onClose(): void }) {
  const t = T[lang];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop method-backdrop" onClick={onClose}>
      <div className="dialog blueprint method-dialog" role="dialog" aria-modal="true" aria-labelledby="method-title" onClick={(e) => e.stopPropagation()}>
        <Corners />
        <h2 id="method-title" className="dialog-title" style={{ margin: 0, fontSize: 30, textTransform: 'uppercase' }}>{t.method}</h2>
        {METHOD[lang].map((m) => (
          <div key={m.h} className="stack-4">
            <h3 style={{ margin: 0, fontSize: 18 }}>{m.h}</h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, textWrap: 'pretty' }}>{m.p}</p>
          </div>
        ))}
        <div className="dialog-actions">
          <button ref={closeRef} className="btn btn-primary blueprint" onClick={onClose}><Corners />{t.close}</button>
        </div>
      </div>
    </div>
  );
}
