// E:\blog-fabio\src\components\admin\PasswordForm.tsx
'use client';
import { useState } from 'react';
import { api, ApiFailure } from '@/lib/api';

export function PasswordForm() {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      await api('/api/admin/account/password', { method: 'POST', json: { password } });
      setPassword('');
      setMsg({ kind: 'ok', text: 'Password salvata. Dalla prossima volta entri con questa password.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof ApiFailure ? err.error.message : 'Errore inatteso.' });
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="mt-5 flex max-w-md flex-col gap-3">
      <label htmlFor="new-password" className="text-sm font-medium text-ink">Nuova password (almeno 8 caratteri)</label>
      <input
        id="new-password" type={show ? 'text' : 'password'} required minLength={8} maxLength={100}
        autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
        className="rounded-lg border border-line bg-surface px-4 py-3 text-lg text-ink"
      />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-5 w-5 accent-[#345A6C]" /> Mostra la password
      </label>
      <button disabled={saving} className="rounded-lg bg-accent-strong px-4 py-3 text-lg font-medium text-white disabled:opacity-60">
        {saving ? 'Salvataggio…' : 'Salva la password'}
      </button>
      {msg && <p role="status" className={msg.kind === 'ok' ? 'text-ink' : 'text-danger'}>{msg.text}</p>}
    </form>
  );
}
