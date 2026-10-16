# Atlas de Desastres

Mapa mundial de desastres naturales en un globo 3D. Usa solo fuentes oficiales y científicas: USGS, NASA EONET, GDACS, Smithsonian GVP, PB2002 y Natural Earth.
Está construido a partir del handoff de diseño en `../design_handoff_atlas_desastres/`.

## Correr

```bash
npm install
npm run ingest      # primera carga: últimos 30 días + capas de referencia (~25 s)
npm run backfill    # opcional: último año de histórico (~2 min)
npm run dev         # http://localhost:3000 → redirige a /es o /en
```

La base es un archivo SQLite local (`data/atlas.db`, ignorado por git). Si se pide un período que todavía no está cargado, se trae de la fuente en ese momento y queda guardado. Por eso el sitio funciona aunque no se haya corrido la ingesta, solo que el primer pedido de cada período tarda más.

Variables en `.env.example`.

## Datos: ingesta → base → web

```
fuentes oficiales ──(jobs.ts)──▶ libSQL ──(ingest.ts)──▶ /api/events, /evento/[id]
      ▲                            │
 cron (diario o c/10 min)     coverage: ventanas ya cargadas por fuente
 backfill histórico          ingest_runs: última corrida OK/error (footer "Estado de fuentes")
```

- **Cron en vivo** (`runLiveIngest`): cubre los últimos 30 días. USGS es incremental (`updatedafter` + `includedeleted`, así que los sismos revisados se actualizan y los eliminados se borran). EONET y GDACS vuelven a pedir los últimos días para captar los eventos que siguen activos. Las capas GVP y placas se refrescan cada 7 y 30 días.
- **Backfill** (`npm run backfill -- 2010 2025 [usgs,eonet,gdacs]`): sismos desde M4.5 y pedidos en bloques para no pasar los límites de las APIs (USGS 20.000, EONET 5.000). Se puede retomar, porque saltea los bloques ya cargados.
- **Lectura**: `/api/events` consulta la base, aplica el merge GDACS→evento y devuelve el estado de cada fuente según su última corrida. 1 año pasó de ~25 s a ~0,2 s.
- **Fallas**: si una fuente no responde, se marca "Sin conexión" y se muestra lo que ya hay en la base. `fetchJson` reintenta los errores de red, 429 y 5xx.

### Programar la ingesta

| Dónde | Cómo |
| --- | --- |
| Vercel | `vercel.json` llama a `/api/cron/ingest` una vez por día (06:00 UTC), que es el máximo del plan Hobby. Para cada 10 min: plan Pro (cambiar el `schedule` a `*/10 * * * *`) o un scheduler externo. |
| Scheduler externo | [cron-job.org](https://cron-job.org) (gratis) u otro: `GET https://<tu-sitio>/api/cron/ingest` cada 10 min con el header `Authorization: Bearer <CRON_SECRET>`. |
| Servidor propio | `INGEST_INTERVAL_MIN=10 npm start` corre la ingesta dentro del proceso (`src/instrumentation.ts`). |
| Manual o cron del SO | `npm run ingest` |

En producción serverless el archivo local no persiste. Usar Turso (`STORAGE_URL=libsql://…`, `STORAGE_AUTH_TOKEN`, los nombres que crea la integración de Vercel con prefijo STORAGE; también se aceptan `DATABASE_URL`/`DATABASE_AUTH_TOKEN` y `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`), que habla el mismo protocolo libSQL. Sin `STORAGE_URL`, en Vercel se usa `/tmp/atlas.db`: el sitio funciona, pero cada instancia nueva arranca vacía y vuelve a pedir los datos a las fuentes.

## Publicar en Vercel

1. **Turso desde Vercel**: en el proyecto de Vercel, Storage → Turso, con prefijo `STORAGE`. La integración crea `STORAGE_URL` y `STORAGE_AUTH_TOKEN` en las variables de entorno; el código las lee tal cual.
2. **Cargar la base desde tu máquina**: bajar esas variables a `.env.local` (no se sube a git)

   ```
   npx vercel link
   npx vercel env pull .env.local
   ```

   y correr `npm run ingest` y después `npm run backfill`. Las tablas se crean solas en la primera conexión. Así el sitio arranca con 30 días al detalle y el último año desde M4.5, sin esperas.
3. **Vercel**: el proyecto importa el repo `Desastres-Naturales` desde GitHub. Framework: Next.js. El proyecto está en la raíz, no hay que cambiar nada.
4. **Variables de entorno** (Settings → Environment Variables, entorno Production):

   | Variable | Valor |
   | --- | --- |
   | `STORAGE_URL`, `STORAGE_AUTH_TOKEN` | las crea la integración de Turso |
   | `CRON_SECRET` | una cadena larga al azar. Sin ella, `/api/cron/ingest` responde 401 en producción. |
   | `NEXT_PUBLIC_SITE_URL` | opcional, solo con dominio propio. Si falta, se usa el dominio `*.vercel.app` de producción. |

5. **Deploy**. Cada `git push` a `master` vuelve a publicar el sitio. Para comprobarlo, abrir `/es`, ver que el pie diga "OK" en las tres fuentes y abrir `/sitemap.xml`.
6. **Ingesta frecuente** (opcional): configurar el scheduler externo de la tabla de arriba.

## Estructura

| Ruta | Qué hace |
| --- | --- |
| `src/app/[lang]/` | Home del mapa (`/es`, `/en`), con el período y el evento en la URL (`?range=30d`, `?range=year&year=2011`, `?e=us6000u1yx`) |
| `src/app/[lang]/evento/[id]/` | Ficha permalink (`/es/evento/us6000u1yx`, `eonet-EONET_123`, `gdacs-TC1001335`): SSR sin JS, metadatos SEO/OG/Twitter, `hreflang` e imagen OG 1200×630 con el globo centrado en el evento |
| `src/app/[lang]/ranking` | Ranking de países por período (`?range=30d`, `?range=year&year=2011`), ordenable por alertas, eventos, mayor sismo o tipo (`?orden=fire`) |
| `src/app/[lang]/pais/[iso]` | Ficha de país (`/es/pais/chl`): alertas, puesto, mayor sismo, desglose por tipo, globo encuadrado y lista de eventos |
| `src/app/sitemap.ts`, `src/app/robots.ts` | Sitemap con inicio, ranking, países con eventos en el último año y eventos destacados (alerta naranja/roja o sismo M6+), cada uno con su par ES/EN |
| `src/app/api/events` | Eventos de un período desde la base |
| `src/app/api/event` | Un evento por id (lo usa el mapa con `?e=id`) |
| `src/app/api/gvp`, `src/app/api/plates` | Capas de referencia guardadas en la base |
| `src/app/api/eq-detail` | Incertidumbres del sismo (origin, ShakeMap, DYFI), en vivo desde USGS |
| `src/app/api/cron/ingest` | Dispara la ingesta en vivo |
| `src/lib/server/sources.ts` | Clientes de cada fuente y normalización al modelo unificado (`src/lib/types.ts`) |
| `src/lib/server/jobs.ts` | Ingesta: bloques, cobertura, cron, backfill y completado al vuelo |
| `src/lib/server/db.ts` | Esquema y consultas libSQL (`events`, `coverage`, `ingest_runs`, `kv`) |
| `src/lib/server/ingest.ts` | Lectura para la web: período, merge GDACS y evento por id |
| `src/lib/server/stats.ts` | Agregación por país y ranking (sismos desde M4.5) |
| `src/lib/countries.ts` | ISO 3166-1 (numérico → alfa-3) y nombres localizados con `Intl.DisplayNames` |
| `src/components/Globe.tsx` | Globo d3-geo ortográfico en canvas: arrastre, rueda, pellizco, tap, hover y vuelo |
| `src/components/Atlas.tsx` | Filtros, overlays, "Más relevantes", ficha, cercanos y estado de fuentes |
| `src/app/industry.css` | Sistema de diseño Industry (copiado del handoff) |

## Pendiente (según README del handoff)

- Definir `NEXT_PUBLIC_SITE_URL` en producción (base de las URLs absolutas de OG y canonical).
- `/api/events?range=1y` pesa ~6,6 MB de JSON: conviene recortar campos para la lista o paginar por tipo.
- Ranking y país recalculan la agregación en cada pedido (~0,2 s para 1 año); si crece, materializar por país y período en la ingesta.
- Páginas `/comparar`, `/linea-de-tiempo`, `/metodologia` y `/aprender/*`.
- Riesgo sísmico GEM (revisar la licencia) y víctimas históricas EM-DAT (requiere registro).
