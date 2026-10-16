/**
 * URL pública del sitio (OG, canonical, sitemap). Orden: NEXT_PUBLIC_SITE_URL
 * (dominio propio) → dominio de producción que asigna Vercel → localhost.
 */
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000')
).replace(/\/+$/, '');
