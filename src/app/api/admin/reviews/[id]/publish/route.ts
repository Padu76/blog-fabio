// E:\blog-fabio\src\app\api\admin\reviews\[id]\publish\route.ts
// "Approva e pubblica" / "Pubblica aggiornamento": transazione atomica nel DB (RPC), poi invalidazione cache.
import { z } from 'zod';
import { requireOperator } from '@/server/auth/guard';
import { AppError, assertSameOrigin, fail, fromDbError, ok, readJson } from '@/server/http';
import { revalidatePublic } from '@/server/reviews/revalidate';

const schema = z.object({
  expected_version: z.number().int(),
  confirm_placeholder: z.boolean().default(false),
  idempotency_key: z.string().min(8).max(100),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { supabase } = await requireOperator();
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new AppError('VALIDATION_ERROR', 'Dati non validi.');
    const { data, error } = await supabase.rpc('bfb_publish_review', {
      p_review_id: id,
      p_expected_version: p.data.expected_version,
      p_confirm_placeholder: p.data.confirm_placeholder,
      p_idempotency_key: p.data.idempotency_key,
    });
    if (error) throw fromDbError(error);
    revalidatePublic((data as { slug?: string }).slug);
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
