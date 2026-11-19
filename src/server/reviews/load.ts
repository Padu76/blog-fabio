// E:\blog-fabio\src\server\reviews\load.ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/server/http';
import type { EditorState } from '@/shared/review';

export async function loadEditorState(db: SupabaseClient, id: string): Promise<EditorState> {
  const { data: r } = await db.from('bfb_reviews')
    .select(`id, state, slug, version, updated_at, published_at, first_published_at, placeholder_ok, body, spoiler_body,
      has_spoilers, excerpt, rating, tags, private_notes, book_id, edition_id, published_revision_id,
      bfb_books(id, title, subtitle, authors),
      bfb_editions(id, isbn10, isbn13, publisher, year, language, page_count, provider, source_url, cover_mode, cover_url, cover_attribution)`)
    .eq('id', id).maybeSingle();
  if (!r) throw new AppError('NOT_FOUND', 'Recensione non trovata.');

  let changed = true;
  if (r.published_revision_id) {
    const { data: pr } = await db.from('bfb_review_revisions')
      .select('body, spoiler_body, has_spoilers, excerpt, rating, tags, book_snapshot')
      .eq('id', r.published_revision_id).maybeSingle();
    if (pr) {
      const b = r.bfb_books as unknown as { title: string } | null;
      const e = r.bfb_editions as unknown as { cover_url: string | null } | null;
      const snap = (pr.book_snapshot ?? {}) as { title?: string; cover_url?: string | null };
      changed = !(pr.body === r.body && pr.spoiler_body === (r.has_spoilers ? r.spoiler_body : '')
        && pr.has_spoilers === r.has_spoilers && pr.excerpt === r.excerpt && Number(pr.rating) === Number(r.rating)
        && JSON.stringify(pr.tags) === JSON.stringify(r.tags) && snap.title === b?.title
        && (snap.cover_url ?? null) === (e?.cover_url ?? null));
    }
  }
  let others = 0;
  if (r.book_id) {
    const { count } = await db.from('bfb_reviews').select('id', { count: 'exact', head: true })
      .eq('book_id', r.book_id).neq('id', r.id);
    others = count ?? 0;
  }

  return {
    id: r.id,
    state: r.state,
    slug: r.slug,
    version: r.version,
    updated_at: r.updated_at,
    published_at: r.published_at,
    first_published_at: r.first_published_at,
    placeholder_ok: r.placeholder_ok,
    fields: {
      body: r.body, spoiler_body: r.spoiler_body, has_spoilers: r.has_spoilers, excerpt: r.excerpt,
      rating: r.rating === null ? null : Number(r.rating), tags: r.tags ?? [], private_notes: r.private_notes,
    },
    book: (r.bfb_books as unknown as EditorState['book']) ?? null,
    edition: (r.bfb_editions as unknown as EditorState['edition']) ?? null,
    has_unpublished_changes: r.state === 'published' ? changed : false,
    other_reviews_of_book: others,
  };
}
