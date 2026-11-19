// E:\blog-fabio\src\lib\env.ts
// Variabili d'ambiente. Le chiavi segrete si leggono SOLO lato server (vedi serverEnv).

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
};

export function serverEnv() {
  if (typeof window !== 'undefined') throw new Error('serverEnv() usato nel browser');
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
    editorialModel: process.env.EDITORIAL_MODEL || 'claude-haiku-5-5',
    aiDailyLimit: Number.parseInt(process.env.AI_DAILY_LIMIT ?? '', 10) || 30,
    googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY ?? '',
    bootstrapAdminEmail: (process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase(),
    featureAudio: process.env.FEATURE_AUDIO === 'true',
    openaiKey: process.env.OPENAI_API_KEY ?? '',
  };
}

export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseKey);
}
