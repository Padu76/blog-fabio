// E:\blog-fabio\src\components\admin\LoginForm.tsx
'use client';
import { useState } from 'react';
import { api, ApiFailure } from '@/lib/api';
import { clearLocalDrafts } from '@/components/admin/localDraft';

export function LoginForm({ signedIn }: { signedIn: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending'); setMsg(null);
    try {
      const r = await api<{ message: string }>('/api/auth/magic-link', { method: 'POST', json: { email } });
      setMsg(r.message); setState('sent');
    } catch (err) {
      setMsg(err instanceof ApiFailure ? err.error.message : 'Errore inatteso.'); setState('idle');
    }
  }

  async function signOut() {
    await api('/api/auth/signout', { method: 'POST', json: {} }).catch(() => null);
    clearLocalDrafts();
    window.location.reload();
  }

  return (
    <>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium text-ink">Email</label>
        <input
          id="email" type="email" required autoComplete="email" inputMode="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-line bg-surface px-4 py-3 text-lg text-ink"
        />
        <button disabled={state === 'sending'} className="rounded-lg bg-accent-strong px-4 py-3 text-lg font-medium text-white disabled:opacity-60">
          {state === 'sending' ? 'Invio…' : 'Mandami il link'}
        </button>
        {msg && <p role="status" className="text-ink">{msg}</p>}
      </form>
      {signedIn && (
        <button onClick={signOut} className="mt-6 self-start text-sm text-muted underline">Esci da questo account</button>
      )}
    </>
  );
}
