// E:\blog-fabio\src\app\api\auth\signout\route.ts
import { createUserClient } from '@/lib/supabase/server';
import { assertSameOrigin, fail, ok } from '@/server/http';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const supabase = await createUserClient();
    await supabase.auth.signOut();
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
