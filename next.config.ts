import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cliente libSQL con binarios nativos: no empaquetarlo.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // La imagen OG lee las fuentes con fs: incluirlas en el bundle serverless (Vercel).
  outputFileTracingIncludes: {
    "/[lang]/evento/[id]/opengraph-image": [
      "./node_modules/@fontsource/newsreader/files/newsreader-latin-{400,600}-normal.woff",
      "./node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-{400,600}-normal.woff",
    ],
  },
};

export default nextConfig;
