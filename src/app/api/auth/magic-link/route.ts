// E:\blog-fabio\src\app\api\auth\magic-link\route.ts
// Invia il link di accesso SOLO agli operatori registrati in bfb_admins (o all'email di bootstrap se non c'è ancora
// nessun operatore). La risposta è sempre la stessa, per non rivelare quali email sono abilitate.
import { z } from 'zod';
import { headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv, serverEnv } from '@/lib/env';
import { createServiceClient, hasServiceRole } from '@/lib/supabase/server';
import { AppError, assertSameOrigin, fail, ok, readJson } from '@/server/http';

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });
const GENERIC = 'Se l’indirizzo è abilitato, a breve riceverai un’email con il link per entrare.';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Inserisci un indirizzo email valido.');
    const { email } = parsed.data;
    if (!hasServiceRole()) throw new AppError('CONFIG_MISSING', 'Accesso non ancora configurato (manca la chiave server di Supabase).');

    const svc = createServiceClient();
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const [{ data: okIp }, { data: okMail }] = await Promise.all([
      svc.rpc('bfb_rate_hit', { p_bucket: `login-ip:${ip}`, p_window_seconds: 900, p_max: 10 }),
      svc.rpc('bfb_rate_hit', { p_bucket: `login-mail:${email}`, p_window_seconds: 900, p_max: 4 }),
    ]);
    if (okIp === false || okMail === false) {
      throw new AppError('RATE_LIMITED', 'Troppi tentativi. Riprova tra un quarto d’ora.');
    }

    const { data: op } = await svc.from('bfb_admins').select('user_id, active').eq('email', email).maybeSingle();
    let allowed = Boolean(op?.active);
    let allowCreate = false;
    if (!allowed) {
      const boot = serverEnv().bootstrapAdminEmail;
      if (boot && email === boot) {
        const { count } = await svc.from('bfb_admins').select('user_id', { count: 'exact', head: true });
        if ((count ?? 0) === 0) { allowed = true; allowCreate = true; }
      }
    }
    if (!allowed) return ok({ message: GENERIC });

    const cookieStore = await cookies();
    const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback`, shouldCreateUser: allowCreate },
    });
    if (error) {
      console.error('magic link', error.status, error.message);
      if (error.status === 429) throw new AppError('RATE_LIMITED', 'Troppe email inviate. Riprova più tardi.');
      throw new AppError('INTERNAL', 'Invio dell’email non riuscito. Riprova tra poco.', true);
    }
    return ok({ message: GENERIC });
  } catch (e) {
    return fail(e);
  }
}
