// E:\blog-fabio\src\app\manifest.ts
import type { MetadataRoute } from 'next';
import { getPublicSettings } from '@/server/settings';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { site } = await getPublicSettings();
  return {
    name: site.name,
    short_name: site.name.length > 14 ? 'Scaffale' : site.name,
    description: site.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#F8F5EE',
    theme_color: '#345A6C',
    lang: 'it',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Nuova recensione', url: '/admin/recensioni/nuova' }],
  };
}
