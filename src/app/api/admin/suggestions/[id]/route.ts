// E:\blog-fabio\src\app\api\admin\suggestions\[id]\route.ts
// Accetta o scarta una proposta AI. Accettando, il testo dettato viene prima salvato come snapshot nella cronologia.
import { z } from 'zod';
import { requireOperator } from '@/server/auth/guard';
import { AppError, assertSameOrigin, fail, fromDbError, ok, readJson } from '@/server/http';
import { loadEditorState } from '@/server/reviews/load';

const schema = z.object({ action: z.enum(['accept', 'discard']), expected_version: z.number().int().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { operator, supabase } = await requireOperator();
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new AppError('VALIDATION_ERROR', 'Azione non valida.');
    const { data: s } = await supabase.from('bfb_ai_suggestions')
      .select('id, review_id, field, input_version, original_text, proposed_text, status').eq('id', id).maybeSingle();
    if (!s) throw new AppError('NOT_FOUND', 'Proposta non trovata.');
    if (s.status !== 'pending') throw new AppError('SUGGESTION_STALE', 'Questa proposta è già stata gestita.');
    const now = new Date().toISOString();

    if (p.data.action === 'discard') {
      await supabase.from('bfb_ai_suggestions').update({ status: 'discarded', decided_at: now }).eq('id', id);
      return ok({ status: 'discarded' });
    }

    const { data: r } = await supabase.from('bfb_reviews').select('id, version, body, spoiler_body').eq('id', s.review_id).maybeSingle();
    if (!r) throw new AppError('NOT_FOUND', 'Recensione non trovata.');
    const current = (s.field === 'body' ? r.body : r.spoiler_body).trim();
    if (current !== s.original_text || (p.data.expected_version !== undefined && p.data.expected_version !== r.version)) {
      // il testo è cambiato dopo la richiesta: non sovrascriviamo il lavoro di Fabio
      await supabase.from('bfb_ai_suggestions').update({ status: 'stale', decided_at: now }).eq('id', id);
      throw new AppError('SUGGESTION_STALE', 'Hai modificato il testo dopo la richiesta: la proposta non è più applicabile. Chiedine una nuova.');
    }
    const { error: se } = await supabase.rpc('bfb_snapshot_review', { p_review_id: r.id, p_note: 'Testo originale prima della correzione AI' });
    if (se) throw fromDbError(se);
    const { data: upd } = await supabase.from('bfb_reviews')
      .update({ [s.field]: s.proposed_text }).eq('id', r.id).eq('version', r.version).select('version').maybeSingle();
    if (!upd) throw new AppError('REVISION_CONFLICT', 'La bozza è cambiata nel frattempo: ricarica e riprova.');
    await supabase.from('bfb_ai_suggestions').update({ status: 'accepted', decided_at: now }).eq('id', id);
    await supabase.from('bfb_audit_events').insert({
      actor_id: operator.userId, action: 'ai.suggestion_accepted', target_type: 'review', target_id: r.id,
      metadata: { suggestion_id: id, field: s.field },
    });
    return ok({ status: 'accepted', state: await loadEditorState(supabase, r.id) });
  } catch (e) {
    return fail(e);
  }
}
