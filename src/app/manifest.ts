import type { MetadataRoute } from 'next';

/** Manifiesto de la app instalable (PWA). "/" redirige a /es o /en según el idioma del navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Mapa de Desastres',
    short_name: 'Desastres',
    description: 'Sismos, volcanes, tsunamis, incendios y huracanes en vivo, con avisos y simuladores.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fafaf8',
    theme_color: '#fafaf8',
    lang: 'es',
    categories: ['news', 'weather', 'education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
