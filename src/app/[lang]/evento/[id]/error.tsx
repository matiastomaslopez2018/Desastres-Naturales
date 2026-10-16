'use client';

import { useParams } from 'next/navigation';
import { T, isLang } from '@/lib/i18n';
import { EventMessage } from '@/components/EventMessage';

/** La fuente oficial no respondió (distinto de "no existe"). */
export default function EventError({ reset }: { error: Error; reset(): void }) {
  const { lang } = useParams<{ lang: string }>();
  const l = isLang(lang) ? lang : 'es';
  const t = T[l];
  return (
    <EventMessage title={t.errorTitle} text={t.errorText} href={`/${l}`} back={t.backToMap}
      action={<button className="btn btn-primary" onClick={reset}>{t.retry}</button>} />
  );
}
