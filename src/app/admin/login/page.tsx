// E:\blog-fabio\src\app\admin\login\page.tsx
import { BooksIcon } from '@/components/Logo';
import { LoginForm } from '@/components/admin/LoginForm';
import { getOperator } from '@/server/auth/guard';
import { redirect } from 'next/navigation';

type SP = Promise<{ e?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const { e } = await searchParams;
  const { operator, signedIn } = await getOperator();
  if (operator) redirect('/');
  const message = e === 'forbidden' || (signedIn && !operator)
    ? 'Questo account non è abilitato all’area riservata. Usa l’account Google con l’email che Andrea ha registrato.'
    : e === 'link' ? 'Il link non è più valido o è già stato usato: chiedine uno nuovo.' : null;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="flex items-center gap-3 text-accent-strong">
        <BooksIcon className="h-10 w-10" />
        <h1 className="font-serif text-3xl text-ink">Area riservata</h1>
      </div>
      <p className="mt-4 text-muted">
        Entra con il tuo account Google: è il modo più semplice.
      </p>
      {message && <p role="alert" className="mt-4 rounded-md border border-danger/40 bg-surface p-3 text-danger">{message}</p>}
      <LoginForm signedIn={signedIn} />
    </div>
  );
}
