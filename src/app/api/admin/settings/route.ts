// E:\blog-fabio\src\app\api\admin\settings\route.ts
import { revalidateTag, revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOperator } from '@/server/auth/guard';
import { AppError, assertSameOrigin, fail, ok, readJson } from '@/server/http';
import { aiSettingsSchema, featuresSchema, siteSettingsSchema } from '@/shared/settings';
import { SETTINGS_TAG } from '@/server/settings';
import { publicEnv } from '@/lib/env';

const schema = z.object({
  site: siteSettingsSchema.optional(),
  features: featuresSchema.optional(),
  ai: aiSettingsSchema.optional(),
});

function checkMediaUrl(url: string | null) {
  if (!url) return;
  const allowed = `${publicEnv.supabaseUrl}/storage/v1/object/public/bfb-media/`;
  // ammessa anche la foto hero iniziale da Unsplash (licenza Unsplash, link diretto come da linee guida)
  if (!url.startsWith(allowed) && !url.startsWith('https://images.unsplash.com/')) {
    throw new AppError('VALIDATION_ERROR', 'Le immagini vanno caricate dal pannello.');
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { operator, supabase } = await requireOperator({ admin: true });
    const p = schema.safeParse(await readJson(req));
    if (!p.success) throw new AppError('VALIDATION_ERROR', p.error.issues[0]?.message ?? 'Dati non validi.');
    const { site, features, ai } = p.data;
    if (site) { checkMediaUrl(site.hero_image_url); checkMediaUrl(site.bio_photo_url); }
    // Le funzioni P1 restano spente finché Andrea non le fa sviluppare
    if (features && (features.discovery || features.blind_book || features.journeys || features.public_audio || features.audio)) {
      throw new AppError('VALIDATION_ERROR', 'Queste funzioni non sono ancora disponibili.');
    }
    const rows = [
      site && { key: 'site', value: site, visibility: 'public', updated_by: operator.userId },
      features && { key: 'features', value: features, visibility: 'public', updated_by: operator.userId },
      ai && { key: 'ai', value: ai, visibility: 'private', updated_by: operator.userId },
    ].filter(Boolean);
    if (rows.length === 0) return ok({ saved: false });
    const { error } = await supabase.from('bfb_settings').upsert(rows as object[]);
    if (error) throw new AppError('INTERNAL', 'Impostazioni non salvate.', true);
    await supabase.from('bfb_audit_events').insert({
      actor_id: operator.userId, action: 'settings.update', target_type: 'settings',
      metadata: { keys: rows.map((r) => (r as { key: string }).key) },
    });
    revalidateTag(SETTINGS_TAG);
    revalidatePath('/', 'layout');
    return ok({ saved: true });
  } catch (e) {
    return fail(e);
  }
}
