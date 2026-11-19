// E:\blog-fabio\src\server\catalog\openLibrary.ts
// Open Library: ricerca + Covers API. Copertine sempre come URL diretti di covers.openlibrary.org (?default=false
// restituisce 404 se manca, così non scambiamo un'immagine vuota per una copertina).
import 'server-only';
import { isValidIsbn10, isValidIsbn13 } from '@/shared/isbn';
import { type CatalogCandidate, type CatalogProvider, yearFrom } from './types';

const UA = { 'User-Agent': 'BlogLibriFabio/1.0 (catalogo personale)' };

type OLDoc = {
  key: string; title?: string; subtitle?: string; author_name?: string[]; first_publish_year?: number;
  cover_edition_key?: string; language?: string[]; publisher?: string[];
};

export function olCover(editionKey: string) {
  return `https://covers.openlibrary.org/b/olid/${editionKey}-L.jpg?default=false`;
}

export const openLibrary: CatalogProvider = {
  id: 'open_library',
  async search({ title, author, isbn13 }, signal) {
    try {
      if (isbn13) {
        const res = await fetch(`https://openlibrary.org/isbn/${isbn13}.json`, { signal, headers: UA, cache: 'no-store' });
        if (res.status === 404) return { candidates: [], failed: false };
        if (!res.ok) return { candidates: [], failed: true, reason: `http_${res.status}` };
        const ed = await res.json();
        const c = await editionToCandidate(ed, signal, 'isbn');
        return { candidates: c ? [c] : [], failed: false };
      }
      const tries: { params: Record<string, string>; match: CatalogCandidate['matchType'] }[] = [];
      if (title && author) tries.push({ params: { title, author }, match: 'title_author' });
      if (title) tries.push({ params: { title }, match: 'title' });
      tries.push({ params: { q: [title, author].filter(Boolean).join(' ') }, match: 'generic' });
      for (const t of tries) {
        const url = new URL('https://openlibrary.org/search.json');
        Object.entries(t.params).forEach(([k, v]) => url.searchParams.set(k, v));
        url.searchParams.set('limit', '10');
        url.searchParams.set('fields', 'key,title,subtitle,author_name,first_publish_year,cover_edition_key,language,publisher');
        const res = await fetch(url, { signal, headers: UA, cache: 'no-store' });
        if (res.status === 429) return { candidates: [], failed: true, reason: 'quota' };
        if (!res.ok) return { candidates: [], failed: true, reason: `http_${res.status}` };
        const json = (await res.json()) as { docs?: OLDoc[] };
        const docs = (json.docs ?? []).filter((d) => d.title);
        if (docs.length === 0) continue;
        return {
          failed: false,
          // Livello "opera": ISBN, editore e anno dell'edizione si leggono alla selezione (edizione precisa),
          // così copertina e ISBN restano coerenti tra loro.
          candidates: docs.map((d): CatalogCandidate => ({
            provider: 'open_library',
            externalId: d.cover_edition_key ?? d.key,
            title: d.title!.trim(),
            subtitle: d.subtitle?.trim() || null,
            authors: (d.author_name ?? []).slice(0, 6),
            publisher: null,
            publicationDateText: null,
            year: null,
            language: d.language?.length === 1 ? d.language[0] : null,
            isbn10: null,
            isbn13: null,
            pageCount: null,
            coverUrl: d.cover_edition_key ? olCover(d.cover_edition_key) : null,
            sourceUrl: `https://openlibrary.org${d.cover_edition_key ? `/books/${d.cover_edition_key}` : d.key}`,
            editionKey: d.cover_edition_key ?? null,
            matchType: t.match,
          })),
        };
      }
      return { candidates: [], failed: false };
    } catch (e) {
      return { candidates: [], failed: true, reason: (e as Error).name === 'AbortError' ? 'timeout' : 'network' };
    }
  },
};

type OLEdition = {
  key?: string; title?: string; subtitle?: string; publishers?: string[]; publish_date?: string;
  isbn_13?: string[]; isbn_10?: string[]; number_of_pages?: number; languages?: { key: string }[];
  covers?: number[]; authors?: { key: string }[]; works?: { key: string }[];
};

const LANG: Record<string, string> = { ita: 'it', eng: 'en', fre: 'fr', ger: 'de', spa: 'es', por: 'pt' };

/** Dati precisi di un'edizione Open Library (per la selezione). */
export async function editionToCandidate(
  ed: OLEdition, signal: AbortSignal, match: CatalogCandidate['matchType'], fallbackAuthors: string[] = [],
): Promise<CatalogCandidate | null> {
  if (!ed?.key || !ed.title) return null;
  const olid = ed.key.split('/').pop()!;
  let authors = fallbackAuthors;
  if (authors.length === 0 && ed.authors?.length) {
    const names = await Promise.all(
      ed.authors.slice(0, 4).map(async (a) => {
        try {
          const r = await fetch(`https://openlibrary.org${a.key}.json`, { signal, headers: UA, cache: 'no-store' });
          return r.ok ? ((await r.json()) as { name?: string }).name ?? null : null;
        } catch { return null; }
      }),
    );
    authors = names.filter((n): n is string => Boolean(n));
  }
  const i13 = ed.isbn_13?.map((s) => s.replace(/-/g, '')).find(isValidIsbn13) ?? null;
  const i10 = ed.isbn_10?.map((s) => s.replace(/-/g, '')).find(isValidIsbn10) ?? null;
  const lang = ed.languages?.[0]?.key?.split('/').pop();
  return {
    provider: 'open_library',
    externalId: olid,
    title: ed.title.trim(),
    subtitle: ed.subtitle?.trim() || null,
    authors,
    publisher: ed.publishers?.[0]?.trim() || null,
    publicationDateText: ed.publish_date ?? null,
    year: yearFrom(ed.publish_date),
    language: lang ? LANG[lang] ?? lang : null,
    isbn13: i13,
    isbn10: i10,
    pageCount: ed.number_of_pages && ed.number_of_pages > 0 ? ed.number_of_pages : null,
    coverUrl: ed.covers?.some((c) => c > 0) ? olCover(olid) : null,
    sourceUrl: `https://openlibrary.org/books/${olid}`,
    editionKey: olid,
    matchType: match,
  };
}

export async function fetchOpenLibraryEdition(olid: string, signal: AbortSignal, fallbackAuthors: string[]) {
  if (!/^OL\d+M$/.test(olid)) return null;
  const res = await fetch(`https://openlibrary.org/books/${olid}.json`, { signal, headers: UA, cache: 'no-store' });
  if (!res.ok) return null;
  return editionToCandidate(await res.json(), signal, 'title', fallbackAuthors);
}
