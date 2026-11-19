// E:\blog-fabio\src\lib\api.ts
'use client';

export type ApiError = { code: string; message: string; retryable?: boolean; request_id?: string; current?: unknown };

export class ApiFailure extends Error {
  constructor(public status: number, public error: ApiError) { super(error.message); }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiFailure(0, { code: 'OFFLINE', message: 'Connessione assente. Riprova quando sei online.', retryable: true });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiFailure(res.status, data?.error ?? { code: 'INTERNAL', message: 'Errore inatteso.', retryable: true });
  }
  return data as T;
}

/** Riduce un'immagine nel browser prima dell'upload (limite di dimensione delle funzioni server). */
export async function shrinkImage(file: File, maxSide: number): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Usa un’immagine JPEG, PNG o WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Immagine troppo grande (massimo 8 MB).');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.88));
  if (!blob) throw new Error('Immagine non leggibile.');
  if (blob.size > 4 * 1024 * 1024) throw new Error('Immagine ancora troppo grande dopo la riduzione.');
  return blob;
}

export async function uploadImage<T>(url: string, blob: Blob): Promise<T> {
  const fd = new FormData();
  fd.append('file', blob, 'image.webp');
  return api<T>(url, { method: 'POST', body: fd });
}
