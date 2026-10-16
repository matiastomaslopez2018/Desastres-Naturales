import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { LANGS, T, isLang } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';
import '../industry.css';
import '../app.css';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-barlow' });
const barlowCond = Barlow_Condensed({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-barlow-condensed' });

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = T[lang];
  return {
    metadataBase: new URL(SITE_URL),
    title: t.brand,
    description: t.brandSub,
    alternates: { languages: { es: '/es', en: '/en' } },
    openGraph: { title: t.brand, description: t.brandSub, type: 'website', locale: lang === 'es' ? 'es_AR' : 'en_US' },
  };
}

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} className={`${barlow.variable} ${barlowCond.variable}`}>
      <body>{children}</body>
    </html>
  );
}
