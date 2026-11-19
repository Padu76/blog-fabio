// E:\blog-fabio\src\app\api\admin\reviews\[id]\cover\route.ts
// Copertina caricata a mano per l'edizione della recensione. Se l'edizione è già usata da una pagina pubblicata,
// la pagina online non cambia finché Fabio non pubblica l'aggiornamento (snapshot nella revisione).
import { requireOperator } from '@/server/auth/guard';
import { createServiceClient } from '@/lib/supabase/server';
import { AppError, assertSameOrigin, fail, ok } from '@/server/http';
import { processImage, readImageFromRequest, uploadPublic } from '@/server/media/image';
import { loadEditorState } from '@/server/reviews/load';

export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { operator, supabase } = await requireOperator();
    const { data: r } = await supabase.from('bfb_reviews').select('id, edition_id').eq('id', id).maybeSingle();
    if (!r) throw new AppError('NOT_FOUND', 'Recensione non trovata.');
    if (!r.edition_id) throw new AppError('VALIDATION_ERROR', 'Prima scegli o inserisci il libro.');
    const img = await processImage(await readImageFromRequest(req), 1200);
    const svc = createServiceClient();
    const up = await uploadPublic(svc, 'bfb-covers', r.edition_id, img.data);
    const { error } = await supabase.from('bfb_editions').update({
      cover_mode: 'uploaded', cover_url: up.url, cover_storage_path: up.path, cover_provider: null,
      cover_attribution: null, cover_source_page_url: null, cover_width: img.width, cover_height: img.height,
      cover_checked_at: new Date().toISOString(),
    }).eq('id', r.edition_id);
    if (error) throw new AppError('INTERNAL', 'Copertina non salvata.', true);
    await supabase.from('bfb_audit_events').insert({
      actor_id: operator.userId, action: 'cover.upload', target_type: 'edition', target_id: r.edition_id,
    });
    return ok(await loadEditorState(supabase, id));
  } catch (e) {
    return fail(e);
  }
}
