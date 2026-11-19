// E:\blog-fabio\src\components\admin\editor\AiSuggestion.tsx
// Proposta AI affiancata all'originale: confronto parola per parola, Fabio accetta o scarta.
'use client';
import { useMemo, useState } from 'react';
import { diffWordsWithSpace } from 'diff';
import type { SuggestionInfo } from '@/shared/review';

export function AiSuggestion({
  s, busy, onAccept, onDiscard,
}: { s: SuggestionInfo; busy: boolean; onAccept: () => void; onDiscard: () => void }) {
  const [view, setView] = useState<'diff' | 'proposed' | 'original'>('diff');
  const parts = useMemo(() => diffWordsWithSpace(s.original_text, s.proposed_text), [s]);
  const changes = parts.filter((p) => p.added || p.removed).length;

  return (
    <section aria-label="Proposta di correzione" className="rounded-xl border-2 border-accent bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-ink">Proposta di correzione {s.field === 'spoiler_body' ? '(parte spoiler)' : ''}</h3>
        <span className="text-sm text-muted">{changes} modifiche · non ancora applicata</span>
      </div>
      <div role="tablist" className="mt-3 flex gap-1 text-sm">
        {(['diff', 'proposed', 'original'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} type="button" onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 ${view === v ? 'bg-accent-strong text-white' : 'border border-line text-ink'}`}>
            {v === 'diff' ? 'Differenze' : v === 'proposed' ? 'Corretto' : 'Il tuo testo'}
          </button>
        ))}
      </div>
      <div className="mt-3 max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-bg p-3 font-serif text-[1.05rem] leading-relaxed text-ink">
        {view === 'diff' && parts.map((p, i) =>
          p.added ? <ins key={i} className="rounded bg-[#d9eadf] px-0.5 text-[#1f5131] no-underline">{p.value}</ins>
            : p.removed ? <del key={i} className="rounded bg-[#f3dada] px-0.5 text-danger">{p.value}</del>
              : <span key={i}>{p.value}</span>)}
        {view === 'proposed' && s.proposed_text}
        {view === 'original' && s.original_text}
      </div>
      {view === 'diff' && (
        <p className="mt-1 text-xs text-muted">
          <ins className="bg-[#d9eadf] px-1 text-[#1f5131] no-underline">aggiunto</ins>{' '}
          <del className="bg-[#f3dada] px-1 text-danger">tolto</del>
        </p>
      )}
      {s.uncertain.length > 0 && (
        <div className="mt-3 rounded-lg bg-accent-soft/60 p-3 text-sm">
          <p className="font-medium text-ink">Da controllare (non corretti):</p>
          <ul className="mt-1 list-disc pl-5 text-ink">
            {s.uncertain.map((u, i) => <li key={i}><strong>«{u.text}»</strong> — {u.reason}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={onAccept} className="rounded-lg bg-accent-strong px-4 py-2.5 font-medium text-white disabled:opacity-60">
          Usa il testo corretto
        </button>
        <button type="button" disabled={busy} onClick={onDiscard} className="rounded-lg border border-line px-4 py-2.5 text-ink disabled:opacity-60">
          Scarta
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Se accetti, il tuo testo dettato resta salvato nella cronologia.</p>
    </section>
  );
}
