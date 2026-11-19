// E:\blog-fabio\src\components\admin\editor\History.tsx
'use client';
import { useState } from 'react';
import type { RevisionInfo } from '@/shared/review';
import { formatRating } from '@/shared/review';

const dt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });

export function History({ revisions, onRestore }: { revisions: RevisionInfo[]; onRestore: (r: RevisionInfo) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (revisions.length === 0) return <p className="text-sm text-muted">Nessuna versione salvata finora: compaiono qui le pubblicazioni e i testi prima delle correzioni AI.</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
      {revisions.map((r) => (
        <li key={r.id} className="p-3">
          <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-2 text-left">
            <span className="text-sm font-medium text-ink">
              {r.kind === 'published' ? `Pubblicata (versione ${r.revision_number})` : r.note || `Copia ${r.revision_number}`}
            </span>
            <span className="ml-auto text-xs text-muted">{dt.format(new Date(r.created_at))}</span>
          </button>
          {open === r.id && (
            <div className="mt-2">
              {r.rating !== null && <p className="text-sm text-muted">Voto: {formatRating(Number(r.rating))}/10</p>}
              <div className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-line bg-bg p-2 font-serif text-sm text-ink">{r.body}</div>
              <button type="button" onClick={() => onRestore(r)} className="mt-2 text-sm text-accent-strong underline">
                Rimetti questo testo nella bozza
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
