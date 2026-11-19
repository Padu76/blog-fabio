// E:\blog-fabio\src\app\api\admin\reviews\[id]\route.ts
// GET stato privato, PATCH salvataggio con versione attesa (409 se cambiata altrove), DELETE definitivo (solo non pubblicate).
import { requireOperator } from '@/server/auth/guard';
import { AppError, assertSameOrigin, fail, ok, readJson } from '@/server/http';
import { loadEditorState } from '@/server/reviews/load';
import { patchSchema } from '@/shared/review';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase } = await requireOperator();
    return ok(await loadEditorState(supabase, id));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { supabase } = await requireOperator();
    const p = patchSchema.safeParse(await readJson(req));
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Dati non validi.');
    const { expected_version, fields } = p.data;
    if (fields.tags) fields.tags = [...new Set(fields.tags.map((t) => t.toLowerCase()))];
    if (Object.keys(fields).length === 0) return ok(await loadEditorState(supabase, id));

    const { data, error } = await supabase.from('bfb_reviews')
      .update(fields).eq('id', id).eq('version', expected_version)
      .select('version, updated_at').maybeSingle();
    if (error) throw new AppError('INTERNAL', 'Salvataggio non riuscito.', true);
    if (!data) {
      const current = await loadEditorState(supabase, id); // lancia NOT_FOUND se non esiste o non è tua
      throw new AppError('REVISION_CONFLICT', 'Questa bozza è stata modificata in un’altra scheda.', false, { current });
    }
    return ok({ version: data.version, updated_at: data.updated_at });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { operator, supabase } = await requireOperator();
    const { data: r } = await supabase.from('bfb_reviews').select('state').eq('id', id).maybeSingle();
    if (!r) throw new AppError('NOT_FOUND', 'Recensione non trovata.');
    if (r.state === 'published') throw new AppError('VALIDATION_ERROR', 'Prima ritira la recensione dal sito.');
    const { error } = await supabase.from('bfb_reviews').delete().eq('id', id);
    if (error) throw new AppError('INTERNAL', 'Eliminazione non riuscita.', true);
    await supabase.from('bfb_audit_events').insert({
      actor_id: operator.userId, action: 'review.delete', target_type: 'review', target_id: id,
    });
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
