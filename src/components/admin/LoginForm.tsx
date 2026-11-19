// E:\blog-fabio\src\components\admin\LoginForm.tsx
// Accesso con la sola password. Chi non la ricorda può farsi mandare un link via email.
'use client';
import { useState } from 'react';
import { api, ApiFailure } from '@/lib/api';
import { clearLocalDrafts } from '@/components/admin/localDraft';
import { createBrowserSupabase } from '@/lib/supabase/browser';

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

  async function google() {
    setState('sending'); setMsg(null);
    const { error } = await createBrowserSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    if (error) { setMsg({ kind: 'err', text: 'Accesso con Google non riuscito. Riprova.' }); setState('idle'); }
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
      <button type="button" onClick={() => void google()} disabled={state === 'sending'}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 text-lg font-medium text-ink shadow-sm hover:border-accent-strong disabled:opacity-60">
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8z" />
          <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.3-2.8l-3.6-2.7c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.800 14.100a6.600 6.600 0 0 1 0-4.200V7.100H2.100a11 11 0 0 0 0 9.800l3.700-2.800z" />
          <path fill="#EA4335" d="M12 5.400c1.600 0 3 .6 4.200 1.600l3.100-3.100A11 11 0 0 0 2.100 7.100l3.700 2.800c.9-2.600 3.300-4.500 6.200-4.500z" />
        </svg>
        Entra con Google
      </button>
      <p className="mt-6 text-center text-sm text-muted">oppure con la password</p>
      <form onSubmit={submit} className="mt-2 flex flex-col gap-3">
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
