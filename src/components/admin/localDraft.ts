// E:\blog-fabio\src\components\admin\localDraft.ts
// Copia locale di sicurezza del testo (per chiusure improvvise o rete assente). Rimossa al logout.
'use client';
import type { WorkingFields } from '@/shared/review';

const PREFIX = 'bfb-draft:';

export type LocalDraft = { fields: WorkingFields; baseVersion: number; savedAt: number };

export function readLocalDraft(id: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch { return null; }
}

export function writeLocalDraft(id: string, d: LocalDraft) {
  try { localStorage.setItem(PREFIX + id, JSON.stringify(d)); } catch { /* spazio pieno o privato */ }
}

export function removeLocalDraft(id: string) {
  try { localStorage.removeItem(PREFIX + id); } catch { /* niente */ }
}

export function clearLocalDrafts() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* niente */ }
}
