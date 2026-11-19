// E:\blog-fabio\src\app\api\admin\reviews\[id]\fix-text\route.ts
// Chiamata sincrona con timeout. Solo operatori, rate limit per utente, tetto giornaliero dal pannello,
// consumi registrati in bfb_ai_usage. Se l'AI non risponde, Fabio continua a scrivere: nessun blocco.
import { z } from 'zod';
import { requireOperator } from '@/server/auth/guard';
import { createServiceClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';
import { AppError, assertSameOrigin, fail, ok, readJson } from '@/server/http';
import { fixText, MAX_INPUT_CHARS, PROMPT_VERSION } from '@/server/ai/fixText';
import { aiSettingsSchema } from '@/shared/settings';

export const maxDuration = 60;

const schema = z.object({
  field: z.enum(['body', 'spoiler_body']).default('body'),
  expected_version: z.number().int(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const { operator, supabase } = await requireOperator();
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new AppError('VALIDATION_ERROR', 'Dati non validi.');

    const { data: aiRow } = await supabase.from('bfb_settings').select('value').eq('key', 'ai').maybeSingle();
    const ai = aiSettingsSchema.parse({ ...(aiRow?.value ?? {}) });
    if (!ai.enabled) throw new AppError('AI_DISABLED', 'La correzione automatica è disattivata nelle impostazioni.');
    const dailyLimit = ai.daily_limit ?? serverEnv().aiDailyLimit;

    const svc = createServiceClient();
    const { data: allowed } = await svc.rpc('bfb_rate_hit', { p_bucket: `ai:${operator.userId}`, p_window_seconds: 60, p_max: 4 });
    if (allowed === false) throw new AppError('RATE_LIMITED', 'Aspetta un minuto prima di chiedere un’altra correzione.');
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await svc.from('bfb_ai_usage').select('id', { count: 'exact', head: true })
      .gte('created_at', dayStart.toISOString());
    if ((count ?? 0) >= dailyLimit) {
      throw new AppError('BUDGET_EXCEEDED', `Raggiunto il limite di ${dailyLimit} correzioni per oggi. Puoi continuare a scrivere e pubblicare; domani si riparte.`);
    }

    const { data: r } = await supabase.from('bfb_reviews')
      .select('id, version, body, spoiler_body, bfb_books(title, authors)').eq('id', id).maybeSingle();
    if (!r) throw new AppError('NOT_FOUND', 'Recensione non trovata.');
    if (r.version !== p.data.expected_version) {
      throw new AppError('REVISION_CONFLICT', 'Salvataggio in corso: riprova tra un istante.', true);
    }
    const text: string = (p.data.field === 'body' ? r.body : r.spoiler_body).trim();
    if (text.length < 20) throw new AppError('VALIDATION_ERROR', 'Scrivi ancora un po’ prima di chiedere la correzione.');
    if (text.length > MAX_INPUT_CHARS) throw new AppError('VALIDATION_ERROR', 'Testo troppo lungo per la correzione automatica.');
    const book = (r.bfb_books as unknown as { title: string; authors: string[] } | null) ?? { title: 'senza titolo', authors: [] };

    let result;
    try {
      result = await fixText(text, book);
    } catch (e) {
      const usage = (e as { usage?: { inTok: number; outTok: number } }).usage;
      await supabase.from('bfb_ai_usage').insert({
        user_id: operator.userId, review_id: id, model: serverEnv().editorialModel,
        input_tokens: usage?.inTok ?? 0, output_tokens: usage?.outTok ?? 0,
        status: e instanceof AppError && e.code === 'PROVIDER_TIMEOUT' ? 'timeout' : e instanceof AppError && e.code === 'AI_OUTPUT_INVALID' ? 'invalid' : 'error',
        error_code: e instanceof AppError ? e.code : 'INTERNAL', duration_ms: Date.now() - started,
      });
      throw e;
    }
    await supabase.from('bfb_ai_usage').insert({
      user_id: operator.userId, review_id: id, model: result.model, input_tokens: result.inputTokens,
      output_tokens: result.outputTokens, status: 'ok', duration_ms: Date.now() - started,
    });
    if (result.corrected_text === text) {
      return ok({ suggestion: null, message: 'Non ho trovato nulla da correggere.' });
    }
    const { data: sug, error } = await supabase.from('bfb_ai_suggestions').insert({
      review_id: id, field: p.data.field, input_version: r.version, input_hash: result.inputHash, model: result.model,
      prompt_version: PROMPT_VERSION, original_text: text, proposed_text: result.corrected_text,
      uncertain: result.uncertain, created_by: operator.userId,
    }).select('id, field, input_version, original_text, proposed_text, uncertain, status, created_at, model').single();
    if (error || !sug) throw new AppError('INTERNAL', 'Proposta non salvata.', true);
    return ok({ suggestion: sug });
  } catch (e) {
    return fail(e);
  }
}
