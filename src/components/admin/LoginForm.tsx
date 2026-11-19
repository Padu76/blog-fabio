// E:\blog-fabio\src\components\admin\LoginForm.tsx
// Accesso con la sola password. Chi non la ricorda può farsi mandare un link via email.
'use client';
import { useState } from 'react';
import { api, ApiFailure } from '@/lib/api';
import { clearLocalDrafts } from '@/components/admin/localDraft';

export function LoginForm({ signedIn }: { signedIn: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending'); setMsg(null);
    try {
      await api('/api/auth/password-login', { method: 'POST', json: { password } });
      // si atterra sul sito: le scorciatoie per scrivere sono nella barra in alto
      window.location.assign('/');
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof ApiFailure ? err.error.message : 'Errore inatteso.' });
      setState('idle');
    }
  }

  async function sendLink() {
    if (!email) { setMsg({ kind: 'err', text: 'Scrivi la tua email.' }); return; }
    setState('sending'); setMsg(null);
    try {
      const r = await api<{ message: string }>('/api/auth/magic-link', { method: 'POST', json: { email } });
      setMsg({ kind: 'ok', text: r.message }); setState('sent');
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof ApiFailure ? err.error.message : 'Errore inatteso.' });
      setState('idle');
    }
  }

  async function signOut() {
    await api('/api/auth/signout', { method: 'POST', json: {} }).catch(() => null);
    clearLocalDrafts();
    window.location.reload();
  }

  const field = 'rounded-lg border border-line bg-surface px-4 py-3 text-lg text-ink';
  return (
    <>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <label htmlFor="password" className="text-sm font-medium text-ink">Password</label>
        <input
          id="password" type={show ? 'text' : 'password'} required autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} className={field}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-5 w-5 accent-[#345A6C]" /> Mostra la password
        </label>
        <button disabled={state === 'sending'} className="mt-1 rounded-lg bg-accent-strong px-4 py-3 text-lg font-medium text-white disabled:opacity-60">
          {state === 'sending' ? 'Un attimo…' : 'Entra'}
        </button>
        {msg && <p role="status" className={msg.kind === 'ok' ? 'text-ink' : 'text-danger'}>{msg.text}</p>}
      </form>
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-accent-strong underline">Non ricordi la password?</summary>
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor="email" className="text-sm text-muted">Scrivi la tua email: ti mandiamo un link per entrare.</label>
          <input
            id="email" type="email" autoComplete="email" inputMode="email" value={email}
            onChange={(e) => setEmail(e.target.value)} className={field}
          />
          <button type="button" onClick={() => void sendLink()} disabled={state === 'sending'} className="self-start rounded-lg border border-accent-strong px-4 py-2.5 text-accent-strong disabled:opacity-60">
            Mandami il link
          </button>
        </div>
      </details>
      {signedIn && (
        <button onClick={signOut} className="mt-4 self-start text-sm text-muted underline">Esci da questo account</button>
      )}
    </>
  );
}
