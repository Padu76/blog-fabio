// E:\blog-fabio\src\app\robots.ts
import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';
import { getPublicSettings } from '@/server/settings';

export const revalidate = 600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { site } = await getPublicSettings();
  // sito in anteprima: niente indicizzazione
  if (site.preview_mode) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/auth/'] }],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
