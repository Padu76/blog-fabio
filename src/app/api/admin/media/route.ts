// E:\blog-fabio\src\app\api\admin\media\route.ts
// Immagine hero e foto della biografia (bucket bfb-media). Solo amministratori.
import { requireOperator } from '@/server/auth/guard';
import { createServiceClient } from '@/lib/supabase/server';
import { AppError, assertSameOrigin, fail, ok } from '@/server/http';
import { processImage, readImageFromRequest, uploadPublic } from '@/server/media/image';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await requireOperator({ admin: true });
    const kind = new URL(req.url).searchParams.get('kind');
    if (kind !== 'hero' && kind !== 'bio') throw new AppError('VALIDATION_ERROR', 'Tipo di immagine non valido.');
    const img = await processImage(await readImageFromRequest(req), kind === 'hero' ? 1800 : 900);
    const up = await uploadPublic(createServiceClient(), 'bfb-media', kind, img.data);
    return ok({ url: up.url, width: img.width, height: img.height });
  } catch (e) {
    return fail(e);
  }
}
