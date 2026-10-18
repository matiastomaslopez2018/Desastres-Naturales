import { NextResponse } from 'next/server';
import { getSevere } from '@/lib/server/severe';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getSevere(), { headers: { 'Cache-Control': 'public, s-maxage=300' } });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
