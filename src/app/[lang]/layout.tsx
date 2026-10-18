import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Instrument_Sans, Instrument_Serif } from 'next/font/google';
import { LANGS, T, isLang } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';
import '../base.css';
import '../night.css';
import '../paper.css';
import '../observatorio.css';

// "Observatorio claro": Instrument Sans para la interfaz y el texto, Instrument Serif para los
// números grandes y los titulares, en todo el sitio.
const sans = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-isans' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'], variable: '--font-iserif' });

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: [{ color: '#fafaf8' }],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = T[lang];
  return {
    metadataBase: new URL(SITE_URL),
    title: t.homeTitle,
    applicationName: t.brand,
    description: t.brandSub,
    alternates: { languages: { es: '/es', en: '/en' } },
    openGraph: { title: t.homeTitle, siteName: t.brand, description: t.brandSub, type: 'website', locale: lang === 'es' ? 'es_AR' : 'en_US' },
    // Google Search Console (método "etiqueta HTML"): el código va en GOOGLE_SITE_VERIFICATION.
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  };
}

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
