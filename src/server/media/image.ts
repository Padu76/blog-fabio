// E:\blog-fabio\src\server\media\image.ts
// Validazione reale dell'immagine (decodifica, non solo estensione), orientamento corretto, metadati rimossi,
// ricodifica in WebP. Niente SVG. Caricamento nei bucket pubblici SOLO dopo la validazione.
import 'server-only';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/server/http';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

export async function readImageFromRequest(req: Request): Promise<Buffer> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > MAX_UPLOAD_BYTES + 100_000) throw new AppError('VALIDATION_ERROR', 'Immagine troppo grande (massimo 8 MB).');
  let form: FormData;
  try { form = await req.formData(); } catch { throw new AppError('VALIDATION_ERROR', 'Caricamento non leggibile.'); }
  const file = form.get('file');
  if (!(file instanceof Blob)) throw new AppError('VALIDATION_ERROR', 'Nessun file ricevuto.');
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError('VALIDATION_ERROR', 'Immagine troppo grande (massimo 8 MB).');
  return Buffer.from(await file.arrayBuffer());
}

export async function processImage(input: Buffer, maxSide: number) {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Il file non è un’immagine valida.');
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new AppError('VALIDATION_ERROR', 'Formato non ammesso: usa JPEG, PNG o WebP.');
  }
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate() // corregge l'orientamento EXIF
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 }) // l'output non contiene i metadati originali
      .toBuffer({ resolveWithObject: true });
    if (info.width < 60 || info.height < 60) throw new AppError('VALIDATION_ERROR', 'Immagine troppo piccola.');
    return { data, width: info.width, height: info.height };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('VALIDATION_ERROR', 'Immagine danneggiata o non leggibile.');
  }
}

export async function uploadPublic(svc: SupabaseClient, bucket: 'bfb-covers' | 'bfb-media', prefix: string, data: Buffer) {
  const path = `${prefix}/${randomUUID()}.webp`;
  const { error } = await svc.storage.from(bucket).upload(path, data, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
  if (error) throw new AppError('INTERNAL', 'Caricamento dell’immagine non riuscito.', true);
  const { data: pub } = svc.storage.from(bucket).getPublicUrl(path);
  return { path, url: pub.publicUrl };
}
