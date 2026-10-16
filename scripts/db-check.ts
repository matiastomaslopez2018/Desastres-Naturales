/** Muestra a qué base se conecta (sin el token), crea las tablas si faltan y cuenta registros. `npm run db:check` */
import { db, dbInfo } from '@/lib/server/db';

(async () => {
  console.table(dbInfo());
  const c = await db(); // crea las tablas si no existen
  for (const t of ['events', 'coverage', 'ingest_runs', 'kv']) {
    const r = await c.execute(`SELECT COUNT(*) AS n FROM ${t}`);
    console.log(`${t.padEnd(12)} ${r.rows[0].n}`);
  }
  const bySrc = await c.execute('SELECT src, COUNT(*) AS n FROM events GROUP BY src ORDER BY n DESC');
  console.table(bySrc.rows.map((r) => ({ fuente: String(r.src), eventos: Number(r.n) })));
  process.exit(0);
})().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
