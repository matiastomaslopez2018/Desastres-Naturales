/**
 * Programador local opcional (servidor propio, `next start` o `next dev`):
 * con INGEST_INTERVAL_MIN=10 corre la ingesta en vivo cada 10 minutos dentro
 * del proceso. En Vercel usar el cron de vercel.json en su lugar.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/server/scheduler');
    startScheduler();
  }
}
