// E:\blog-fabio\src\app\api\admin\reviews\route.ts
import { requireOperator } from '@/server/auth/guard';
import { AppError, assertSameOrigin, fail, ok } from '@/server/http';

/** Crea una bozza vuota. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { operator, supabase } = await requireOperator();
    const { data, error } = await supabase.from('bfb_reviews')
      .insert({ owner_id: operator.userId }).select('id').single();
    if (error || !data) throw new AppError('INTERNAL', 'Creazione della bozza non riuscita.', true);
    await supabase.from('bfb_audit_events').insert({
      actor_id: operator.userId, action: 'review.create', target_type: 'review', target_id: data.id,
    });
    return ok({ id: data.id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
