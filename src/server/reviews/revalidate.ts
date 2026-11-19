// E:\blog-fabio\src\server\reviews\revalidate.ts
import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';

export const PUBLIC_REVIEWS_TAG = 'bfb-public-reviews';

export function revalidatePublic(slug?: string | null) {
  revalidateTag(PUBLIC_REVIEWS_TAG);
  revalidatePath('/');
  revalidatePath('/recensioni');
  revalidatePath('/sitemap.xml');
  if (slug) revalidatePath(`/recensioni/${slug}`);
}
