'use client';

import { EventMessage } from '@/components/EventMessage';
import { useParams } from 'next/navigation';
import { T, isLang } from '@/lib/i18n';

export default function EventNotFound() {
  const { lang } = useParams<{ lang: string }>();
  const t = T[isLang(lang) ? lang : 'es'];
  return <EventMessage title={t.notFoundTitle} text={t.notFoundText} href={`/${isLang(lang) ? lang : 'es'}`} back={t.backToMap} />;
}

