// E:\blog-fabio\src\components\public\OperatorBar.tsx
// Scorciatoie per chi è entrato nell'area riservata, mostrate sulle pagine pubbliche.
// I visitatori normali non fanno nessuna richiesta: si parte solo se c'è il cookie di sessione.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Me = { operator: boolean; isAdmin?: boolean; reviewId?: string | null; preview?: boolean; name?: string | null; email?: string };

export function OperatorBar() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!/(^|;\s*)sb-[^=]*-auth-token/.test(document.cookie)) return;
    const m = pathname.match(/^\/recensioni\/([a-z0-9-]+)$/);
    const ctrl = new AbortController();
    fetch(`/api/auth/me${m ? `?slug=${m[1]}` : ''}`, { credentials: 'same-origin', cache: 'no-store', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setMe(j as Me); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [pathname]);

  if (!me?.operator) return null;
  const btn = 'inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-base font-medium';
  const ghost = `${btn} border border-[#FBF6EC]/60 hover:bg-[#FBF6EC]/10`;
  return (
    <div className="sticky top-0 z-40 border-b border-ink/20 bg-ink text-[#FBF6EC]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
        <p className="mr-auto text-sm">
          <strong>{me.name || me.email}</strong>
          {me.name && me.email ? <span className="hidden text-[#FBF6EC]/70 sm:inline"> · {me.email}</span> : null}
          <span className="text-[#FBF6EC]/80"> — {me.preview ? 'sito in anteprima, lo vede solo chi è entrato' : 'sei nell’area riservata'}</span>
        </p>
        {me.reviewId && (
          <Link href={`/admin/recensioni/${me.reviewId}`} className={ghost}>Modifica questa recensione</Link>
        )}
        <Link href="/admin/recensioni/nuova" className={`${btn} bg-[#FBF6EC] text-ink hover:bg-white`}>+ Scrivi una recensione</Link>
        <Link href="/admin" className={ghost}>Le mie recensioni</Link>
        {me.isAdmin && (
          <Link href="/admin/impostazioni" className={`${ghost} hidden sm:inline-flex`}>Impostazioni</Link>
        )}
      </div>
    </div>
  );
}
