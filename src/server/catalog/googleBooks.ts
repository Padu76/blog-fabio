// E:\blog-fabio\src\server\catalog\googleBooks.ts
// Google Books API v1 (gratuita). Le copertine restano link diretti a Google (nessun rehosting).
import 'server-only';
import { serverEnv } from '@/lib/env';
import { isValidIsbn10, isValidIsbn13 } from '@/shared/isbn';
import { type CatalogCandidate, type CatalogProvider, yearFrom } from './types';

type GVolume = {
  id: string;
  volumeInfo?: {
    title?: string; subtitle?: string; authors?: string[]; publisher?: string; publishedDate?: string;
    language?: string; pageCount?: number; printType?: string; canonicalVolumeLink?: string; infoLink?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

function coverFrom(v: GVolume): string | null {
  const t = v.volumeInfo?.imageLinks?.thumbnail ?? v.volumeInfo?.imageLinks?.smallThumbnail;
  if (!t) return null;
  try {
    const u = new URL(t.replace(/^http:/, 'https:'));
    u.searchParams.delete('edge');
    return u.toString();
  } catch {
    return null;
  }
}

function q(s: string) {
  return s.replace(/[":]/g, ' ').trim();
}

export const googleBooks: CatalogProvider = {
  id: 'google_books',
  async search({ title, author, isbn13 }, signal) {
    const key = serverEnv().googleBooksKey;
    const queries: { query: string; match: CatalogCandidate['matchType'] }[] = [];
    if (isbn13) queries.push({ query: `isbn:${isbn13}`, match: 'isbn' });
    else {
      if (title && author) queries.push({ query: `intitle:${q(title)} inauthor:${q(author)}`, match: 'title_author' });
      if (title) queries.push({ query: `intitle:${q(title)}`, match: 'title' });
      queries.push({ query: [title, author].filter(Boolean).map(q).join(' '), match: 'generic' });
    }
    for (const { query, match } of queries) {
      const url = new URL('https://www.googleapis.com/books/v1/volumes');
      url.searchParams.set('q', query);
      url.searchParams.set('maxResults', '12');
      url.searchParams.set('printType', 'books');
      if (key) url.searchParams.set('key', key);
      let res: Response;
      try {
        res = await fetch(url, { signal, cache: 'no-store' });
      } catch (e) {
        return { candidates: [], failed: true, reason: (e as Error).name === 'AbortError' ? 'timeout' : 'network' };
      }
      if (res.status === 429) return { candidates: [], failed: true, reason: 'quota' };
      if (!res.ok) return { candidates: [], failed: true, reason: `http_${res.status}` };
      const json = (await res.json()) as { items?: GVolume[] };
      const items = (json.items ?? []).filter((v) => v.volumeInfo?.title);
      if (items.length === 0) continue; // query meno restrittiva
      return {
        failed: false,
        candidates: items.map((v): CatalogCandidate => {
          const info = v.volumeInfo!;
          const ids = info.industryIdentifiers ?? [];
          const i13 = ids.find((i) => i.type === 'ISBN_13')?.identifier ?? null;
          const i10 = ids.find((i) => i.type === 'ISBN_10')?.identifier ?? null;
          return {
            provider: 'google_books',
            externalId: v.id,
            title: info.title!.trim(),
            subtitle: info.subtitle?.trim() || null,
            authors: (info.authors ?? []).map((a) => a.trim()).filter(Boolean),
            publisher: info.publisher?.trim() || null,
            publicationDateText: info.publishedDate ?? null,
            year: yearFrom(info.publishedDate),
            language: info.language ?? null,
            isbn13: i13 && isValidIsbn13(i13) ? i13 : null,
            isbn10: i10 && isValidIsbn10(i10) ? i10 : null,
            pageCount: info.pageCount && info.pageCount > 0 ? info.pageCount : null,
            coverUrl: coverFrom(v),
            sourceUrl: info.canonicalVolumeLink ?? info.infoLink ?? `https://books.google.com/books?id=${v.id}`,
            matchType: match,
          };
        }),
      };
    }
    return { candidates: [], failed: false };
  },
};
