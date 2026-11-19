// E:\blog-fabio\src\components\admin\SignOutButton.tsx
'use client';
import { api } from '@/lib/api';
import { clearLocalDrafts } from './localDraft';

export function SignOutButton() {
  async function out() {
    await api('/api/auth/signout', { method: 'POST', json: {} }).catch(() => null);
    clearLocalDrafts();
    window.location.href = '/admin/login';
  }
  return <button onClick={out} className="rounded px-2 py-2 text-sm text-muted hover:text-ink">Esci</button>;
}
