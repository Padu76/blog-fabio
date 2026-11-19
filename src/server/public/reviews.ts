// E:\blog-fabio\src\server\public\reviews.ts
// Lettura pubblica: solo la proiezione bfb_public_reviews (righe visibili, campi approvati). Mai bozze o note.
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { PUBLIC_REVIEWS_TAG } from '@/server/reviews/revalidate';

export type PublicCard = {
  slug: string; title: string; authors: string[]; cover_url: string | null; rating: number; excerpt: string;
  has_spoilers: boolean; published_at: string; first_published_at: string; tags: string[];
};
export type PublicReview = PublicCard & {
  review_id: string; subtitle: string | null; publisher: string | null; year: number | null; isbn13: string | null;
  language: string | null; page_count: number | null; cover_attribution: string | null;
  cover_source_page_url: string | null; body: string; spoiler_body: string;
};

const CARD_COLS = 'slug, title, authors, cover_url, rating, excerpt, has_spoilers, published_at, first_published_at, tags';

function toCard<T extends { rating: unknown }>(r: T) {
  return { ...r, rating: Number(r.rating) };
}

export const getLatestReviews = unstable_cache(
  async (limit: number): Promise<PublicCard[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await createPublicClient().from('bfb_public_reviews')
      .select(CARD_COLS).order('first_published_at', { ascending: false }).limit(limit);
    if (error) { console.error('latest', error.message); return []; }
    return (data ?? []).map(toCard) as PublicCard[];
  },
  ['bfb-latest'],
  { tags: [PUBLIC_REVIEWS_TAG], revalidate: 600 },
);

export const getReviewBySlug = unstable_cache(
  async (slug: string): Promise<{ review: PublicReview | null; redirectTo: string | null }> => {
    if (!isSupabaseConfigured()) return { review: null, redirectTo: null };
    const db = createPublicClient();
    const { data } = await db.from('bfb_public_reviews')
      .select(`review_id, subtitle, publisher, year, isbn13, language, page_count, cover_attribution, cover_source_page_url,
        body, spoiler_body, ${CARD_COLS}`)
      .eq('slug', slug).maybeSingle();
    if (data) return { review: toCard(data) as unknown as PublicReview, redirectTo: null };
    const { data: red } = await db.from('bfb_slug_redirects').select('review_id').eq('old_slug', slug).maybeSingle();
    if (red) {
      const { data: cur } = await db.from('bfb_public_reviews').select('slug').eq('review_id', red.review_id).maybeSingle();
      if (cur) return { review: null, redirectTo: cur.slug };
    }
    return { review: null, redirectTo: null };
  },
  ['bfb-review-by-slug'],
  { tags: [PUBLIC_REVIEWS_TAG], revalidate: 3600 },
);

export type ArchiveQuery = { q: string; tag: string; band: string; sort: string; page: number };
export const PAGE_SIZE = 12;

function cleanQuery(q: string) {
  return q.replace(/[^\p{L}\p{N}\s'’-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export const searchArchive = unstable_cache(
  async (aq: ArchiveQuery): Promise<{ items: PublicCard[]; total: number }> => {
    if (!isSupabaseConfigured()) return { items: [], total: 0 };
    let query = createPublicClient().from('bfb_public_reviews').select(CARD_COLS, { count: 'exact' });
    const q = cleanQuery(aq.q);
    if (q) {
      // ricerca full-text (italiano) sul solo contenuto senza spoiler + corrispondenza parziale su titolo/autore
      const like = `%${q.replace(/[%_]/g, '')}%`;
      query = query.or(`search_vector.wfts(italian).${JSON.stringify(q)},search_text.ilike.${JSON.stringify(like)}`);
    }
    if (aq.tag) query = query.contains('tags', [aq.tag.toLowerCase()]);
    if (aq.band === 'alto') query = query.gte('rating', 8);
    else if (aq.band === 'medio') query = query.gte('rating', 6).lt('rating', 8);
    else if (aq.band === 'basso') query = query.lt('rating', 6);
    if (aq.sort === 'voto') query = query.order('rating', { ascending: false }).order('first_published_at', { ascending: false });
    else if (aq.sort === 'titolo') query = query.order('title', { ascending: true });
    else query = query.order('first_published_at', { ascending: false });
    const from = (aq.page - 1) * PAGE_SIZE;
    const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) { console.error('archive', error.message); return { items: [], total: 0 }; }
    return { items: (data ?? []).map(toCard) as PublicCard[], total: count ?? 0 };
  },
  ['bfb-archive'],
  { tags: [PUBLIC_REVIEWS_TAG], revalidate: 600 },
);

export const getAllTags = unstable_cache(
  async (): Promise<string[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data } = await createPublicClient().from('bfb_public_reviews').select('tags');
    const set = new Set<string>();
    (data ?? []).forEach((r) => (r.tags as string[]).forEach((t) => set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b, 'it'));
  },
  ['bfb-tags'],
  { tags: [PUBLIC_REVIEWS_TAG], revalidate: 3600 },
);

export const getSitemapEntries = unstable_cache(
  async (): Promise<{ slug: string; published_at: string }[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data } = await createPublicClient().from('bfb_public_reviews').select('slug, published_at');
    return data ?? [];
  },
  ['bfb-sitemap'],
  { tags: [PUBLIC_REVIEWS_TAG], revalidate: 3600 },
);
