// E:\blog-fabio\src\middleware.ts
// 1) Area riservata, API admin e auth: aggiorna la sessione Supabase, mai in cache.
// 2) Pagine pubbliche: se il sito è "in anteprima" le vedono solo gli operatori entrati;
//    tutti gli altri trovano la pagina di attesa. A sito pubblico non si toccano cookie né cache.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let previewCache: { value: boolean; at: number } | null = null;
const PREVIEW_TTL_MS = 15_000;

async function isPreviewMode(): Promise<boolean> {
  if (!SB_URL || !SB_KEY) return false;
  const now = Date.now();
  if (previewCache && now - previewCache.at < PREVIEW_TTL_MS) return previewCache.value;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/bfb_settings?key=eq.site&select=value`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(String(res.status));
    const rows = (await res.json()) as { value?: { preview_mode?: unknown } }[];
    const value = rows[0]?.value?.preview_mode === true;
    previewCache = { value, at: now };
    return value;
  } catch {
    // database non raggiungibile: si tiene l'ultimo valore noto
    return previewCache?.value ?? false;
  }
}

function withSession(request: NextRequest) {
  const box = { response: NextResponse.next({ request }) };
  const supabase = createServerClient(SB_URL!, SB_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        box.response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => box.response.cookies.set(name, value, options));
      },
    },
  });
  return { supabase, box };
}

function privateHeaders(response: NextResponse) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const reserved = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
    || pathname.startsWith('/api/auth') || pathname.startsWith('/auth');

  if (reserved) {
    if (!SB_URL || !SB_KEY) return privateHeaders(NextResponse.next({ request }));
    const { supabase, box } = withSession(request);
    await supabase.auth.getUser();
    return privateHeaders(box.response);
  }

  if (pathname.startsWith('/api') || pathname === '/in-arrivo') return NextResponse.next();
  if (!(await isPreviewMode())) return NextResponse.next();

  // Sito in anteprima: passa solo chi è operatore attivo
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
  if (hasSession) {
    const { supabase, box } = withSession(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('bfb_admins').select('active').eq('user_id', user.id).maybeSingle();
      if (data?.active) return privateHeaders(box.response);
    }
  }
  return privateHeaders(NextResponse.rewrite(new URL('/in-arrivo', request.url)));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icons/|manifest.webmanifest|hero-scaffale.jpg|robots.txt).*)'],
};
