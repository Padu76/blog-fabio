// E:\blog-fabio\src\components\admin\NewReview.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiFailure } from '@/lib/api';

export function NewReview() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<{ id: string }>('/api/admin/reviews', { method: 'POST', json: {} })
      .then((r) => router.replace(`/admin/recensioni/${r.id}`))
      .catch((e) => setError(e instanceof ApiFailure ? e.error.message : 'Errore inatteso.'));
  }, [router]);
  return (
    <p role="status" className="p-6 text-center text-muted">
      {error ?? 'Preparo una nuova bozza…'}
    </p>
  );
}
