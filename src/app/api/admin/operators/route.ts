// E:\blog-fabio\src\app\api\admin\operators\route.ts
// Gestione operatori dal pannello (niente SQL editor): aggiunge un'email come operatore, attiva/disattiva.
// auth.users è condiviso: se l'utente esiste già (es. di un altro progetto) lo si collega senza toccarlo.
import { z } from 'zod';
import { requireOperator } from '@/server/auth/guard';
import { createServiceClient } from '@/lib/supabase/server';
import { AppError, assertSameOrigin, fail, ok, readJson } from '@/server/http';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    email: z.string().trim().toLowerCase().email().max(200),
    role: z.enum(['admin', 'editor']).default('admin'),
    display_name: z.string().trim().max(80).optional(),
  }),
  z.object({ action: z.literal('set_active'), user_id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal('set_password'), user_id: z.string().uuid() }),
]);

/** Password leggibile da dettare o copiare: 3 gruppi da 4, senza caratteri ambigui (0/O, 1/l/I). */
function readablePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join('')).join('-');
}

async function findUserIdByEmail(svc: ReturnType<typeof createServiceClient>, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new AppError('INTERNAL', 'Elenco utenti non disponibile.', true);
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { operator } = await requireOperator({ admin: true });
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new AppError('VALIDATION_ERROR', 'Dati non validi.');
    const svc = createServiceClient();

    if (p.data.action === 'set_active') {
      if (p.data.user_id === operator.userId && !p.data.active) throw new AppError('VALIDATION_ERROR', 'Non puoi disattivare te stesso.');
      const { error } = await svc.from('bfb_admins').update({ active: p.data.active }).eq('user_id', p.data.user_id);
      if (error) throw new AppError('INTERNAL', 'Modifica non riuscita.', true);
      await svc.from('bfb_audit_events').insert({
        actor_id: operator.userId, action: p.data.active ? 'operator.activate' : 'operator.deactivate',
        target_type: 'operator', target_id: p.data.user_id,
      });
      return ok({ ok: true });
    }

    if (p.data.action === 'set_password') {
      // solo per chi è operatore del blog: mai toccare altri utenti dell'istanza condivisa
      const { data: target } = await svc.from('bfb_admins').select('user_id').eq('user_id', p.data.user_id).maybeSingle();
      if (!target) throw new AppError('NOT_FOUND', 'Operatore non trovato.');
      const password = readablePassword();
      const { error } = await svc.auth.admin.updateUserById(p.data.user_id, { password });
      if (error) {
        console.error('nuova password', error.status, error.message);
        throw new AppError('INTERNAL', 'Password non impostata. Riprova tra poco.', true);
      }
      await svc.from('bfb_audit_events').insert({
        actor_id: operator.userId, action: 'operator.password_reset', target_type: 'operator', target_id: p.data.user_id,
      });
      // mostrata una sola volta a chi l'ha chiesta: non viene salvata in chiaro da nessuna parte
      return ok({ ok: true, password });
    }

    const { email, role, display_name } = p.data;
    let userId = await findUserIdByEmail(svc, email);
    if (!userId) {
      const { data, error } = await svc.auth.admin.createUser({ email, email_confirm: true });
      if (error || !data.user) throw new AppError('INTERNAL', 'Creazione dell’utente non riuscita.', true);
      userId = data.user.id;
    }
    const { error } = await svc.from('bfb_admins').upsert({
      user_id: userId, email, role, display_name: display_name || null, active: true,
    });
    if (error) throw new AppError('INTERNAL', 'Operatore non salvato.', true);
    await svc.from('bfb_audit_events').insert({
      actor_id: operator.userId, action: 'operator.add', target_type: 'operator', target_id: userId, metadata: { role },
    });
    return ok({ ok: true, user_id: userId });
  } catch (e) {
    return fail(e);
  }
}
