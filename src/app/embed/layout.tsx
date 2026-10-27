// Diseño propio del widget (/embed): sin encabezado, avisos ni scripts del sitio, para que cargue rápido en
// el sitio que lo inserta. Es otro "root layout" de la app, al lado de app/[lang].
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="wg-body">{children}</body>
    </html>
  );
}
