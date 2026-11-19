// E:\blog-fabio\src\app\sitemap.ts
import type { MetadataRoute } from 'next';
import { getSitemapEntries } from '@/server/public/reviews';
import { publicEnv } from '@/lib/env';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const reviews = await getSitemapEntries();
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/recensioni`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/chi-sono`, changeFrequency: 'monthly', priority: 0.5 },
    ...reviews.map((r) => ({ url: `${base}/recensioni/${r.slug}`, lastModified: r.published_at, priority: 0.7 })),
  ];
}
