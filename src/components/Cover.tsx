// E:\blog-fabio\src\components\Cover.tsx
// Copertina sempre intera (object-contain). Se manca: segnaposto elegante con titolo e autore, mai immagini inventate.
'use client';
import { useState } from 'react';

export function Cover({
  url, title, authors, className = 'w-28', priority = false,
}: { url: string | null; title: string; authors: string[]; className?: string; priority?: boolean }) {
  const [broken, setBroken] = useState(false);
  const alt = `Copertina di ${title}${authors.length ? `, ${authors.join(', ')}` : ''}`;
  return (
    <div className={`${className} relative aspect-[2/3] shrink-0 overflow-hidden rounded-sm bg-surface shadow-[0_2px_10px_rgba(35,54,66,0.18)]`}>
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <div role="img" aria-label={alt} className="flex h-full w-full flex-col justify-between border border-line bg-accent-soft p-3 text-accent-strong">
          <span className="font-serif text-[0.85em] italic leading-tight line-clamp-5">{title}</span>
          <span className="text-[0.65em] uppercase tracking-wide line-clamp-2">{authors.join(', ')}</span>
        </div>
      )}
    </div>
  );
}
