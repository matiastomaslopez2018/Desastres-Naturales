import { NextResponse } from 'next/server';
import { vapidKeys } from '@/lib/server/push';

export const dynamic = 'force-dynamic';

/** Clave pública VAPID para suscribirse a las notificaciones push. */
export async function GET() {
  const { publicKey } = await vapidKeys();
  return NextResponse.json({ key: publicKey }, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
}
