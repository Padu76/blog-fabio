// E:\blog-fabio\src\lib\supabase\server.ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { publicEnv, serverEnv } from '@/lib/env';

/** Client con la sessione dell'utente (cookie): RLS applicata con i suoi permessi. */
export async function createUserClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // chiamato da un Server Component: i cookie li aggiorna il middleware
        }
      },
    },
  });
}

/** Client anonimo senza cookie: per le pagine pubbliche (cacheabili). */
export function createPublicClient() {
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service role: aggira RLS. Usare solo dopo aver verificato l'operatore, e solo per ciò che serve. */
export function createServiceClient() {
  const key = serverEnv().serviceRoleKey;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mancante');
  return createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServiceRole() {
  return Boolean(serverEnv().serviceRoleKey);
}
