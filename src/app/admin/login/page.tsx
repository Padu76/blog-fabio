// E:\blog-fabio\src\app\admin\login\page.tsx
import { BooksIcon } from '@/components/Logo';
import { LoginForm } from '@/components/admin/LoginForm';
import { getOperator } from '@/server/auth/guard';
import { redirect } from 'next/navigation';

type SP = Promise<{ e?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const { e } = await searchParams;
  const { operator, signedIn } = await getOperator();
  if (operator) redirect('/admin');
  const message = e === 'forbidden' || (signedIn && !operator)
    ? 'Questo account non è abilitato all’area riservata.'
    : e === 'link' ? 'Il link non è più valido o è già stato usato: chiedine uno nuovo.' : null;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="flex items-center gap-3 text-accent-strong">
        <BooksIcon className="h-10 w-10" />
        <h1 className="font-serif text-3xl text-ink">Area riservata</h1>
      </div>
      <p className="mt-4 text-muted">
        Scrivi la tua email: ti mandiamo un link per entrare, senza password. Aprilo dallo stesso telefono.
      </p>
      {message && <p role="alert" className="mt-4 rounded-md border border-danger/40 bg-surface p-3 text-danger">{message}</p>}
      <LoginForm signedIn={signedIn} />
    </div>
  );
}
