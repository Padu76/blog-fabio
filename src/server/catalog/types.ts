// E:\blog-fabio\src\server\catalog\types.ts
// Formato normalizzato, indipendente dal fornitore. Campi assenti = null: niente dati inventati.

export type Provider = 'google_books' | 'open_library';

export type CatalogCandidate = {
  provider: Provider;
  externalId: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publicationDateText: string | null;
  year: number | null;
  language: string | null;
  isbn10: string | null;
  isbn13: string | null;
  pageCount: number | null;
  coverUrl: string | null;
  sourceUrl: string | null;
  /** solo per Open Library: id dell'edizione da cui prendere copertina e ISBN coerenti */
  editionKey?: string | null;
  matchType: 'isbn' | 'title_author' | 'title' | 'generic';
};

export type ProviderResult = { candidates: CatalogCandidate[]; failed: boolean; reason?: string };

export interface CatalogProvider {
  id: Provider;
  search(q: { title: string; author: string; isbn13: string | null }, signal: AbortSignal): Promise<ProviderResult>;
}

export const ALLOWED_COVER_HOSTS = new Set([
  'books.google.com',
  'books.googleusercontent.com',
  'covers.openlibrary.org',
]);

export function yearFrom(text: string | null | undefined): number | null {
  const m = text?.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? Number(m[1]) : null;
}
