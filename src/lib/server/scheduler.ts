import { runLiveIngest } from './jobs';

export function startScheduler() {
  const minutes = Number(process.env.INGEST_INTERVAL_MIN);
  if (!minutes || minutes < 1) return;
  const tick = async () => {
    try {
      console.log('[ingest]', JSON.stringify(await runLiveIngest()));
    } catch (err) {
      console.error('[ingest] falló', err);
    }
  };
  setTimeout(tick, 5000);
  setInterval(tick, minutes * 60_000).unref();
  console.log(`[ingest] programada cada ${minutes} min`);
}
