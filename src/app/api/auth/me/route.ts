// E:\blog-fabio\src\app\api\auth\me\route.ts
// Dice al sito pubblico se chi guarda è un operatore entrato (per mostrare le scorciatoie).
// Con ?slug= restituisce anche l'id della recensione, se l'operatore può modificarla.
import { NextResponse } from 'next/server';
import { getOperator } from '@/server/auth/guard';
import { createUserClient } from '@/lib/supabase/server';
import { getPublicSettings } from '@/server/settings';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { operator } = await getOperator();
    if (!operator) return NextResponse.json({ operator: false });
    const slug = new URL(req.url).searchParams.get('slug');
    let reviewId: string | null = null;
    if (slug && /^[a-z0-9-]{1,200}$/.test(slug)) {
      const supabase = await createUserClient();
      const { data } = await supabase.from('bfb_reviews').select('id').eq('slug', slug).maybeSingle();
      reviewId = data?.id ?? null;
    }
    const { site } = await getPublicSettings();
    return NextResponse.json({
      operator: true, isAdmin: operator.role === 'admin', reviewId, preview: site.preview_mode,
      name: operator.displayName, email: operator.email,
    });
  } catch {
    return NextResponse.json({ operator: false });
  }
}
