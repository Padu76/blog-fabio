// E:\blog-fabio\src\app\api\admin\books\search\route.ts
import { requireOperator } from '@/server/auth/guard';
import { createServiceClient } from '@/lib/supabase/server';
import { AppError, fail, ok } from '@/server/http';
import { searchCatalog } from '@/server/catalog/search';

export async function GET(req: Request) {
  try {
    const { operator, supabase } = await requireOperator();
    const url = new URL(req.url);
    const svc = createServiceClient();
    const { data: allowed } = await svc.rpc('bfb_rate_hit', {
      p_bucket: `catalog:${operator.userId}`, p_window_seconds: 60, p_max: 30,
    });
    if (allowed === false) throw new AppError('RATE_LIMITED', 'Troppe ricerche in un minuto, aspetta un attimo.');
    const result = await searchCatalog(svc, supabase, operator.userId, {
      q: url.searchParams.get('q') ?? '',
      author: url.searchParams.get('author') ?? '',
    });
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
