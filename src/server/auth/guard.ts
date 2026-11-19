// E:\blog-fabio\src\server\auth\guard.ts
// Essere autenticati NON basta: serve una riga attiva in bfb_admins (auth.users è condiviso con altri progetti).
import 'server-only';
import { redirect } from 'next/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { AppError } from '@/server/http';
import { isSupabaseConfigured } from '@/lib/env';

export type Operator = { userId: string; email: string; role: 'admin' | 'editor'; displayName: string | null };

export async function getOperator(): Promise<{ operator: Operator | null; signedIn: boolean }> {
  if (!isSupabaseConfigured()) return { operator: null, signedIn: false };
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { operator: null, signedIn: false };
  const { data } = await supabase
    .from('bfb_admins')
    .select('user_id, email, role, display_name, active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data || !data.active) return { operator: null, signedIn: true };
  return {
    operator: { userId: data.user_id, email: data.email, role: data.role, displayName: data.display_name },
    signedIn: true,
  };
}

/** Per le pagine admin: rimanda al login se non autorizzato. */
export async function requireOperatorPage(): Promise<Operator> {
  const { operator, signedIn } = await getOperator();
  if (!operator) redirect(signedIn ? '/admin/login?e=forbidden' : '/admin/login');
  return operator;
}

/** Per le route API admin. */
export async function requireOperator(opts?: { admin?: boolean }) {
  const { operator, signedIn } = await getOperator();
  if (!operator) throw new AppError(signedIn ? 'FORBIDDEN' : 'UNAUTHORIZED', signedIn ? 'Non sei autorizzato.' : 'Accedi di nuovo.');
  if (opts?.admin && operator.role !== 'admin') throw new AppError('FORBIDDEN', 'Serve il ruolo amministratore.');
  const supabase = await createUserClient();
  return { operator, supabase };
}
