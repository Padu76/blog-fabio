// E:\blog-fabio\src\app\api\admin\reviews\[id]\revisions\route.ts
import { requireOperator } from '@/server/auth/guard';
import { assertSameOrigin, fail, fromDbError, ok } from '@/server/http';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireOperator();
    const [{ data: revisions }, { data: suggestions }] = await Promise.all([
      supabase.from('bfb_review_revisions')
        .select('id, revision_number, kind, note, created_at, body, spoiler_body, excerpt, rating')
        .eq('review_id', id).order('revision_number', { ascending: false }).limit(50),
      supabase.from('bfb_ai_suggestions')
        .select('id, field, input_version, original_text, proposed_text, uncertain, status, created_at, model')
        .eq('review_id', id).eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
    ]);
    return ok({ revisions: revisions ?? [], suggestions: suggestions ?? [] });
  } catch (e) {
    return fail(e);
  }
}

/** Salva una copia del testo attuale nella cronologia (es. prima di ripristinare una versione precedente). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { supabase } = await requireOperator();
    const { error } = await supabase.rpc('bfb_snapshot_review', { p_review_id: id, p_note: 'Copia prima di un ripristino' });
    if (error) throw fromDbError(error);
    return ok({ saved: true });
  } catch (e) {
    return fail(e);
  }
}
