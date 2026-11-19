// E:\blog-fabio\src\app\api\admin\books\manual\route.ts
// Inserimento manuale: funziona anche con i cataloghi irraggiungibili.
import { z } from 'zod';
import { requireOperator } from '@/server/auth/guard';
import { AppError, assertSameOrigin, fail, ok, readJson } from '@/server/http';
import { checkIsbn, normalizeTitle } from '@/shared/isbn';
import { attachBook } from '@/server/reviews/attach';

const schema = z.object({
  review_id: z.string().uuid(),
  expected_version: z.number().int(),
  title: z.string().trim().min(1, 'Serve il titolo.').max(300),
  subtitle: z.string().trim().max(300).optional().default(''),
  authors: z.array(z.string().trim().min(1).max(150)).min(1, 'Serve almeno un autore.').max(10),
  publisher: z.string().trim().max(200).optional().default(''),
  year: z.number().int().min(1000).max(2100).nullable().optional(),
  isbn: z.string().trim().max(20).optional().default(''),
  language: z.string().trim().max(10).optional().default(''),
  page_count: z.number().int().min(1).max(20000).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { operator, supabase } = await requireOperator();
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Dati non validi.');
    const d = p.data;
    let isbn10: string | null = null;
    let isbn13: string | null = null;
    if (d.isbn) {
      const c = checkIsbn(d.isbn);
      if (c.kind === 'invalid' || c.kind === 'none') throw new AppError('VALIDATION_ERROR', c.kind === 'invalid' ? c.reason : 'ISBN non valido.');
      if (c.kind === 'isbn13') isbn13 = c.value;
      else { isbn10 = c.value; isbn13 = c.isbn13; }
    }
    const { data: book, error: be } = await supabase.from('bfb_books').insert({
      title: d.title, subtitle: d.subtitle || null, authors: d.authors, normalized_title: normalizeTitle(d.title),
      language: d.language || null, created_by: operator.userId,
    }).select('id').single();
    if (be || !book) throw new AppError('INTERNAL', 'Salvataggio non riuscito.', true);
    const { data: ed, error: ee } = await supabase.from('bfb_editions').insert({
      book_id: book.id, isbn10, isbn13, publisher: d.publisher || null, year: d.year ?? null,
      language: d.language || null, page_count: d.page_count ?? null, provider: 'manual', cover_mode: 'none',
      created_by: operator.userId,
    }).select('id').single();
    if (ee || !ed) throw new AppError('INTERNAL', 'Salvataggio non riuscito.', true);
    return ok(await attachBook(supabase, operator.userId, d.review_id, d.expected_version, book.id, ed.id));
  } catch (e) {
    return fail(e);
  }
}
