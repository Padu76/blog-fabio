// E:\blog-fabio\src\app\api\admin\reviews\[id]\unpublish\route.ts
// "Ritira dal sito" e archiviazione. Il lavoro resta salvato.
import { z } from 'zod';
import { requireOperator } from '@/server/auth/guard';
import { AppError, assertSameOrigin, fail, fromDbError, ok, readJson } from '@/server/http';
import { revalidatePublic } from '@/server/reviews/revalidate';

const schema = z.object({ action: z.enum(['unpublish', 'archive', 'unarchive']) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { supabase } = await requireOperator();
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new AppError('VALIDATION_ERROR', 'Azione non valida.');
    const { data, error } = p.data.action === 'unpublish'
      ? await supabase.rpc('bfb_unpublish_review', { p_review_id: id })
      : await supabase.rpc('bfb_archive_review', { p_review_id: id, p_archive: p.data.action === 'archive' });
    if (error) throw fromDbError(error);
    revalidatePublic((data as { slug?: string }).slug);
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
