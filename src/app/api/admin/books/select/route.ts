// E:\blog-fabio\src\app\api\admin\books\select\route.ts
// Conferma un candidato (dal token server) o un libro già in catalogo, e lo collega alla recensione.
import { z } from 'zod';
import { requireOperator } from '@/server/auth/guard';
import { createServiceClient } from '@/lib/supabase/server';
import { AppError, assertSameOrigin, fail, ok, readJson } from '@/server/http';
import { resolveCandidate, verifyCover } from '@/server/catalog/search';
import { persistCandidate } from '@/server/catalog/persist';
import { attachBook } from '@/server/reviews/attach';

const schema = z.object({
  review_id: z.string().uuid(),
  expected_version: z.number().int(),
  candidate_token: z.string().min(10).max(100).optional(),
  edition_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { operator, supabase } = await requireOperator();
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new AppError('VALIDATION_ERROR', 'Dati non validi.');
    const { review_id, expected_version, candidate_token, edition_id } = p.data;

    let bookId: string;
    let editionId: string;
    if (edition_id) {
      const { data } = await supabase.from('bfb_editions').select('id, book_id').eq('id', edition_id).maybeSingle();
      if (!data) throw new AppError('BOOK_NOT_FOUND', 'Edizione non trovata.');
      bookId = data.book_id; editionId = data.id;
    } else if (candidate_token) {
      const svc = createServiceClient();
      const c = await resolveCandidate(svc, operator.userId, candidate_token);
      const coverOk = await verifyCover(c.coverUrl);
      ({ bookId, editionId } = await persistCandidate(supabase, operator.userId, c, coverOk));
    } else {
      throw new AppError('VALIDATION_ERROR', 'Scegli un libro.');
    }
    const result = await attachBook(supabase, operator.userId, review_id, expected_version, bookId, editionId);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
