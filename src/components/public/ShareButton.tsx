// E:\blog-fabio\src\components\public\ShareButton.tsx
'use client';
import { useState } from 'react';

export function ShareButton({ title }: { title: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch { /* annullato dall'utente */ }
  }
  return (
    <button type="button" onClick={share} className="rounded-md border border-line px-3 py-2 text-ink hover:bg-surface">
      {done ? 'Link copiato' : 'Condividi'}
    </button>
  );
}
