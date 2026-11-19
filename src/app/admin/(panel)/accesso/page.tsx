// E:\blog-fabio\src\app\admin\(panel)\accesso\page.tsx
// "Il mio accesso": l'operatore sceglie o cambia la propria password.
import { requireOperatorPage } from '@/server/auth/guard';
import { PasswordForm } from '@/components/admin/PasswordForm';

export const metadata = { title: 'Il mio accesso' };

export default async function AccessPage() {
  const op = await requireOperatorPage();
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      <h1 className="font-serif text-3xl italic text-ink">Il mio accesso</h1>
      <p className="mt-2 text-muted">Per entrare ti basta la password che scegli qui. Il tuo account è <strong className="text-ink">{op.email}</strong>.</p>
      <PasswordForm />
      <p className="mt-5 max-w-md text-sm text-muted">
        Se la dimentichi, dalla pagina di accesso puoi farti mandare un link via email, oppure chiedi ad Andrea di dartene una nuova.
        La password vale per questa email anche sugli altri siti di Andrea, se li usi.
      </p>
    </div>
  );
}
