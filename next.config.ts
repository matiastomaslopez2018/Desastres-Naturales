import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El indicador "N" de Next.js solo aparece en desarrollo, pero tapa el botón de play del mapa.
  devIndicators: false,
  // Google Search Console (método "archivo HTML"): /google<código>.html lo sirve una ruta de API.
  async rewrites() {
    return [{ source: "/:file(google[0-9a-f]+\\.html)", destination: "/api/google-verification?file=:file" }];
  },
  // Cliente libSQL con binarios nativos: no empaquetarlo.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // La imagen OG lee las fuentes con fs: incluirlas en el bundle serverless (Vercel).
  outputFileTracingIncludes: {
    "/[lang]/evento/[id]/opengraph-image": [
      "./node_modules/@fontsource/newsreader/files/newsreader-latin-{400,600}-normal.woff",
      "./node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-{400,600}-normal.woff",
    ],
    "/[lang]/pais/[iso]/opengraph-image": [
      "./node_modules/@fontsource/newsreader/files/newsreader-latin-{400,600}-normal.woff",
      "./node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-{400,600}-normal.woff",
    ],
  },
};

export default nextConfig;
