// E:\blog-fabio\src\components\public\SiteFooter.tsx
import Link from 'next/link';

export function SiteFooter({ name, note }: { name: string; note: string }) {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} {name}{note ? ` · ${note}` : ''}</p>
        <nav aria-label="Informazioni" className="flex gap-4 sm:ml-auto">
          <Link href="/chi-sono" className="hover:text-accent-strong">Chi sono</Link>
          <Link href="/crediti" className="hover:text-accent-strong">Crediti</Link>
          <Link href="/privacy" className="hover:text-accent-strong">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
