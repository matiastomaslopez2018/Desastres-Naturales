import 'server-only';
import { cache } from 'react';
import { getEventById } from '@/lib/server/ingest';

/** Deduplica el lookup entre generateMetadata, la página y la imagen OG del mismo pedido. */
export const loadEvent = cache((id: string) => getEventById(decodeURIComponent(id)));
