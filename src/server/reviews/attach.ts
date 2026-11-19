// E:\blog-fabio\src\server\reviews\attach.ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/server/http';
import { loadEditorState } from './load';

export async function attachBook(
  db: SupabaseClient, userId: string, reviewId: string, expectedVersion: number, bookId: string, editionId: string,
) {
  const { data, error } = await db.from('bfb_reviews')
    .update({ book_id: bookId, edition_id: editionId })
    .eq('id', reviewId).eq('version', expectedVersion)
    .select('id').maybeSingle();
  if (error) throw new AppError('INTERNAL', 'Collegamento del libro non riuscito.', true);
  if (!data) {
    const { data: exists } = await db.from('bfb_reviews').select('id').eq('id', reviewId).maybeSingle();
    if (!exists) throw new AppError('NOT_FOUND', 'Recensione non trovata.');
    throw new AppError('REVISION_CONFLICT', 'La bozza è stata modificata altrove: ricarica la pagina.');
  }
  await db.from('bfb_audit_events').insert({
    actor_id: userId, action: 'review.book_selected', target_type: 'review', target_id: reviewId,
    metadata: { book_id: bookId, edition_id: editionId },
  });
  return loadEditorState(db, reviewId);
}
