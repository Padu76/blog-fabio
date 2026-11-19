// E:\blog-fabio\src\components\public\SiteHeader.tsx
import Link from 'next/link';
import { BooksIcon } from '@/components/Logo';
import type { Features } from '@/shared/settings';

export function SiteHeader({ name, features }: { name: string; features: Features }) {
  return (
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3 sm:py-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 text-accent-strong sm:gap-3">
          <BooksIcon className="h-7 w-7 shrink-0 sm:h-9 sm:w-9" />
          <span className="hidden h-8 w-px bg-line sm:block" aria-hidden="true" />
          <span className="font-serif text-lg leading-tight text-ink sm:text-3xl">{name}</span>
        </Link>
        <nav aria-label="Principale" className="ml-auto flex shrink-0 items-center gap-0 whitespace-nowrap text-sm sm:gap-5 sm:text-base">
          <Link href="/recensioni" className="rounded px-1.5 py-2 text-ink hover:text-accent-strong sm:px-2">Recensioni</Link>
          {features.journeys && (
            <Link href="/percorsi" className="hidden rounded px-2 py-2 text-ink hover:text-accent-strong sm:inline">Percorsi di lettura</Link>
          )}
          <Link href="/chi-sono" className="rounded px-1.5 py-2 text-ink hover:text-accent-strong sm:px-2">Chi sono</Link>
          <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          <Link href="/recensioni#cerca" className="rounded p-2 text-ink hover:text-accent-strong" aria-label="Cerca tra le recensioni">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
        </nav>
      </div>
    </header>
  );
}
