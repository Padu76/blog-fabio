// E:\blog-fabio\src\app\auth\callback\route.ts
import { NextResponse } from 'next/server';
import { createUserClient, createServiceClient, hasServiceRole } from '@/lib/supabase/server';
import { publicEnv, serverEnv } from '@/lib/env';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const base = publicEnv.siteUrl;
  if (!code) return NextResponse.redirect(`${base}/admin/login?e=link`);

  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${base}/admin/login?e=link`);

  // Bootstrap: il primo amministratore (email in ADMIN_BOOTSTRAP_EMAIL) entra se non esiste ancora nessun operatore.
  const email = (data.user.email ?? '').toLowerCase();
  const boot = serverEnv().bootstrapAdminEmail;
  if (boot && email === boot && hasServiceRole()) {
    const svc = createServiceClient();
    const { count } = await svc.from('bfb_admins').select('user_id', { count: 'exact', head: true });
    if ((count ?? 0) === 0) {
      await svc.from('bfb_admins').insert({ user_id: data.user.id, email, role: 'admin', display_name: null });
      await svc.from('bfb_audit_events').insert({
        actor_id: data.user.id, action: 'operator.bootstrap', target_type: 'operator', target_id: data.user.id,
      });
    }
  }
  return NextResponse.redirect(`${base}/admin`);
}
