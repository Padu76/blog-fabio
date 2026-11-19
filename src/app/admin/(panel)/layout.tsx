// E:\blog-fabio\src\app\admin\(panel)\layout.tsx
import Link from 'next/link';
import { requireOperatorPage } from '@/server/auth/guard';
import { BooksIcon } from '@/components/Logo';
import { SignOutButton } from '@/components/admin/SignOutButton';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const op = await requireOperatorPage();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2">
          <Link href="/admin" className="flex items-center gap-2 text-accent-strong" aria-label="Pannello">
            <BooksIcon className="h-7 w-7" />
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            <Link href="/admin" className="rounded px-2 py-2 text-ink hover:bg-surface">Recensioni</Link>
            {op.role === 'admin' && <Link href="/admin/impostazioni" className="rounded px-2 py-2 text-ink hover:bg-surface">Impostazioni</Link>}
            <Link href="/" className="rounded px-2 py-2 text-ink hover:bg-surface">Vedi il sito</Link>
            <Link href="/admin/accesso" className="whitespace-nowrap rounded px-2 py-2 text-ink hover:bg-surface">Il mio accesso</Link>
          </nav>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-3 pb-24 pt-4">{children}</div>
    </>
  );
}
