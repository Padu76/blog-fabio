// E:\blog-fabio\src\app\api\admin\account\password\route.ts
// L'operatore entrato sceglie o cambia la propria password. La password non viene mai salvata in chiaro né registrata.
import { z } from 'zod';
import { requireOperator } from '@/server/auth/guard';
import { createServiceClient } from '@/lib/supabase/server';
import { AppError, assertSameOrigin, fail, ok, readJson } from '@/server/http';

const schema = z.object({ password: z.string().min(8).max(100) });

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { operator } = await requireOperator();
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new AppError('VALIDATION_ERROR', 'La password deve avere almeno 8 caratteri.');
    const svc = createServiceClient();
    const { error } = await svc.auth.admin.updateUserById(operator.userId, { password: p.data.password });
    if (error) {
      console.error('cambio password', error.status, error.message);
      if (error.status === 422) throw new AppError('VALIDATION_ERROR', 'Password troppo semplice o troppo corta: scegline una più lunga.');
      throw new AppError('INTERNAL', 'Password non salvata. Riprova tra poco.', true);
    }
    await svc.from('bfb_audit_events').insert({
      actor_id: operator.userId, action: 'operator.password_change', target_type: 'operator', target_id: operator.userId,
    });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
