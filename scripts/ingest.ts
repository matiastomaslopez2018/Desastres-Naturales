/** Una corrida de la ingesta en vivo (últimos 30 días + capas de referencia). `npm run ingest` */
import { runLiveIngest } from '@/lib/server/jobs';

const t0 = Date.now();
runLiveIngest()
  .then((summary) => {
    console.table(summary);
    console.log(`listo en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    process.exit(Object.values(summary).every((s) => s.ok) ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
