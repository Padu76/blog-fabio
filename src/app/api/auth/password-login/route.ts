// E:\blog-fabio\src\app\api\auth\password-login\route.ts
// Accesso con la sola password (scelta di Andrea: per Fabio deve essere il più semplice possibile).
// La password viene provata SOLO sugli operatori attivi in bfb_admins; i tentativi sono limitati.
import { z } from 'zod';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import { createServiceClient, hasServiceRole } from '@/lib/supabase/server';
import { AppError, assertSameOrigin, fail, ok, readJson } from '@/server/http';

const bodySchema = z.object({ password: z.string().min(1).max(200) });
const WRONG = 'Password non corretta.';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Inserisci la password.');
    const { password } = parsed.data;
    if (!hasServiceRole()) throw new AppError('CONFIG_MISSING', 'Accesso non ancora configurato (manca la chiave server di Supabase).');

    // Basta la password: per questo i tentativi sono contati per indirizzo e in totale
    const svc = createServiceClient();
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const [{ data: okIp }, { data: okAll }] = await Promise.all([
      svc.rpc('bfb_rate_hit', { p_bucket: `pwd-ip:${ip}`, p_window_seconds: 900, p_max: 10 }),
      svc.rpc('bfb_rate_hit', { p_bucket: 'pwd-all', p_window_seconds: 900, p_max: 60 }),
    ]);
    if (okIp === false || okAll === false) {
      throw new AppError('RATE_LIMITED', 'Troppi tentativi. Riprova tra un quarto d’ora.');
    }

    // auth.users è condiviso con altri progetti: si prova la password SOLO sugli operatori attivi del blog
    const { data: ops } = await svc.from('bfb_admins').select('user_id, email').eq('active', true).order('created_at').limit(10);
    const cookieStore = await cookies();
    const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    });
    let entered = false;
    for (const op of ops ?? []) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: op.email, password });
      if (!error && data.user?.id === op.user_id) { entered = true; break; }
      if (error && error.status !== 400) console.error('password login', error.status, error.message);
    }
    if (!entered) throw new AppError('UNAUTHORIZED', WRONG);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
