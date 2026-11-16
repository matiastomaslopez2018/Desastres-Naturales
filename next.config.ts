import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El indicador "N" de Next.js solo aparece en desarrollo, pero tapa el botón de play del mapa.
  devIndicators: false,
  // Google Search Console (método "archivo HTML"): /google<código>.html lo sirve una ruta de API.
  async rewrites() {
    return [{ source: "/:file(google[0-9a-f]+\\.html)", destination: "/api/google-verification?file=:file" }];
  },
  // Datos estáticos del mapa (GEM, losas, vectores, catálogos): caché larga en el navegador y en la CDN.
  async headers() {
    return [
      { source: "/data/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
      // Páginas que leen la URL (período, filtros): la red de Vercel guarda cada combinación 2 minutos y la sirve vieja hasta
      // una hora mientras la renueva, así el servidor no se ejecuta en cada visita ni con cada robot. Imágenes para redes: un día.
      ...["/:lang(es|en)", "/:lang(es|en)/pais/:iso", "/:lang(es|en)/ranking", "/embed"].map((source) => ({
        source, headers: [{ key: "Vercel-CDN-Cache-Control", value: "max-age=120, stale-while-revalidate=3600" }],
      })),
      { source: "/:path*/opengraph-image-:hash", headers: [{ key: "Vercel-CDN-Cache-Control", value: "max-age=86400, stale-while-revalidate=604800" }] },
      // El service worker se revisa siempre, para que las versiones nuevas lleguen enseguida.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
    ];
  },
  // Cliente libSQL con binarios nativos: no empaquetarlo.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // La imagen OG lee las fuentes con fs: incluirlas en el bundle serverless (Vercel).
  outputFileTracingIncludes: {
    // "Mi lugar" lee el mapa de amenaza de GEM y el catálogo de deslizamientos desde public/.
    "/api/place": ["./public/data/gem-3857.png", "./public/data/glc_fatal.json"],
    "/[lang]/opengraph-image": [
      "./node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff",
      "./node_modules/@fontsource/instrument-sans/files/instrument-sans-latin-{400,600}-normal.woff",
    ],
    "/[lang]/evento/[id]/opengraph-image": [
      "./node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff",
      "./node_modules/@fontsource/instrument-sans/files/instrument-sans-latin-{400,600}-normal.woff",
    ],
    "/[lang]/pais/[iso]/opengraph-image": [
      "./node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff",
      "./node_modules/@fontsource/instrument-sans/files/instrument-sans-latin-{400,600}-normal.woff",
    ],
  },
};

export default nextConfig;
