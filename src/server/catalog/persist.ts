// E:\blog-fabio\src\server\catalog\persist.ts
// Salva opera ed edizione scelte. Nessuna fusione automatica di libri omonimi: si riusa un'opera
// solo se la stessa edizione (fornitore + id esterno, oppure ISBN-13) è già presente.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeTitle } from '@/shared/isbn';
import { AppError } from '@/server/http';
import type { CatalogCandidate } from './types';

export async function persistCandidate(
  db: SupabaseClient, userId: string, c: CatalogCandidate, coverOk: boolean,
): Promise<{ bookId: string; editionId: string }> {
  // edizione già presente?
  let existing = (await db.from('bfb_editions').select('id, book_id')
    .eq('provider', c.provider).eq('external_id', c.externalId).maybeSingle()).data;
  if (!existing && c.isbn13) {
    existing = (await db.from('bfb_editions').select('id, book_id').eq('isbn13', c.isbn13).limit(1).maybeSingle()).data;
  }
  if (existing) return { bookId: existing.book_id, editionId: existing.id };

  const { data: book, error: be } = await db.from('bfb_books').insert({
    title: c.title, subtitle: c.subtitle, authors: c.authors, normalized_title: normalizeTitle(c.title),
    language: c.language, created_by: userId,
  }).select('id').single();
  if (be || !book) throw new AppError('INTERNAL', 'Salvataggio del libro non riuscito.', true);

  const now = new Date().toISOString();
  const { data: ed, error: ee } = await db.from('bfb_editions').insert({
    book_id: book.id,
    isbn10: c.isbn10, isbn13: c.isbn13, publisher: c.publisher, publication_date_text: c.publicationDateText,
    year: c.year, language: c.language, page_count: c.pageCount,
    provider: c.provider, external_id: c.externalId, source_url: c.sourceUrl, fetched_at: now,
    cover_mode: coverOk ? 'external' : 'none',
    cover_url: coverOk ? c.coverUrl : null,
    cover_provider: coverOk ? c.provider : null,
    cover_attribution: coverOk ? (c.provider === 'google_books' ? 'Google Books' : 'Open Library') : null,
    cover_source_page_url: coverOk ? c.sourceUrl : null,
    cover_checked_at: now,
    created_by: userId,
  }).select('id').single();
  if (ee || !ed) {
    // doppio click: l'altra richiesta ha già creato l'edizione
    const again = (await db.from('bfb_editions').select('id, book_id')
      .eq('provider', c.provider).eq('external_id', c.externalId).maybeSingle()).data;
    if (again) return { bookId: again.book_id, editionId: again.id };
    throw new AppError('INTERNAL', 'Salvataggio dell’edizione non riuscito.', true);
  }
  return { bookId: book.id, editionId: ed.id };
}
