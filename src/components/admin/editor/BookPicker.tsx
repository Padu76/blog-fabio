// E:\blog-fabio\src\components\admin\editor\BookPicker.tsx
// Cerca titolo/autore (o ISBN), mostra le edizioni con copertina, conferma lato server. Fallback: inserimento manuale.
'use client';
import { useEffect, useRef, useState } from 'react';
import { api, ApiFailure } from '@/lib/api';
import { Cover } from '@/components/Cover';
import type { EditorState } from '@/shared/review';

type Candidate = {
  candidate_token: string; title: string; subtitle: string | null; authors: string[]; publisher: string | null;
  year: number | null; language: string | null; isbn13: string | null; cover_url: string | null;
  source: 'google_books' | 'open_library'; source_url: string | null;
};
type Local = { book_id: string; edition_id: string | null; title: string; authors: string[]; publisher: string | null; year: number | null; cover_url: string | null; reviewed: boolean };
type SearchResult = { local: Local[]; candidates: Candidate[]; partial_failure: boolean; failed_providers: string[] };

const SOURCE: Record<string, string> = { google_books: 'Google Books', open_library: 'Open Library' };

export function BookPicker({
  reviewId, getVersion, beforeChange, onSelected, onCancel,
}: {
  reviewId: string;
  getVersion: () => number;
  beforeChange: () => Promise<boolean>;
  onSelected: (s: EditorState) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [res, setRes] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = title.trim();
    if (t.length < 3) { setRes(null); setError(null); return; }
    const timer = setTimeout(async () => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setLoading(true); setError(null);
      try {
        const u = new URLSearchParams({ q: t, author: author.trim() });
        const r = await api<SearchResult>(`/api/admin/books/search?${u}`, { signal: c.signal });
        if (!c.signal.aborted) setRes(r);
      } catch (e) {
        if (c.signal.aborted) return;
        setRes(null);
        setError(e instanceof ApiFailure ? e.error.message : 'Ricerca non riuscita.');
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [title, author]);

  async function choose(payload: { candidate_token?: string; edition_id?: string }, key: string) {
    if (busy) return; // niente doppio click
    setBusy(key); setError(null);
    try {
      if (!(await beforeChange())) throw new Error('Salvataggio in corso, riprova tra un attimo.');
      const s = await api<EditorState>('/api/admin/books/select', {
        method: 'POST', json: { review_id: reviewId, expected_version: getVersion(), ...payload },
      });
      onSelected(s);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.error.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (manual) {
    return <ManualBook reviewId={reviewId} getVersion={getVersion} beforeChange={beforeChange} onSelected={onSelected}
      onBack={() => setManual(false)} initialTitle={title} initialAuthor={author} />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Titolo o ISBN
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" enterKeyHint="search"
            className="rounded-lg border border-line bg-surface px-3 py-3 text-lg text-ink" placeholder="Es. Il barone rampante" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Autore (facoltativo)
          <input value={author} onChange={(e) => setAuthor(e.target.value)} autoComplete="off"
            className="rounded-lg border border-line bg-surface px-3 py-3 text-lg text-ink" placeholder="Es. Calvino" />
        </label>
      </div>
      <p className="text-sm text-muted" role="status" aria-live="polite">
        {loading ? 'Cerco…' : res && res.candidates.length === 0 && res.local.length === 0 ? 'Nessun risultato.' : ''}
        {res?.partial_failure && ' Un catalogo non ha risposto: i risultati potrebbero essere incompleti.'}
      </p>
      {error && <p role="alert" className="text-danger">{error}</p>}

      {res && res.local.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted">Già nel tuo catalogo</h4>
          <ul className="mt-1 space-y-2">
            {res.local.map((l) => (
              <li key={l.edition_id ?? l.book_id}>
                <button type="button" disabled={!!busy || !l.edition_id} onClick={() => l.edition_id && choose({ edition_id: l.edition_id }, l.edition_id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-2 text-left hover:border-accent disabled:opacity-60">
                  <Cover url={l.cover_url} title={l.title} authors={l.authors} className="w-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif italic text-ink">{l.title}</span>
                    <span className="block text-sm text-muted">{l.authors.join(', ')}{l.publisher ? ` · ${l.publisher}` : ''}{l.year ? ` · ${l.year}` : ''}</span>
                    {l.reviewed && <span className="text-xs text-danger">Hai già una recensione di questo libro</span>}
                  </span>
                  {busy === l.edition_id && <span className="text-sm text-muted">…</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {res && res.candidates.length > 0 && (
        <ul className="space-y-2">
          {res.candidates.map((c) => (
            <li key={c.candidate_token}>
              <button type="button" disabled={!!busy} onClick={() => choose({ candidate_token: c.candidate_token }, c.candidate_token)}
                className="flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-2 text-left hover:border-accent disabled:opacity-60">
                <Cover url={c.cover_url} title={c.title} authors={c.authors} className="w-16" />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg italic leading-snug text-ink">{c.title}</span>
                  {c.subtitle && <span className="block text-sm text-muted">{c.subtitle}</span>}
                  <span className="block text-sm text-ink">{c.authors.join(', ') || 'autore non indicato'}</span>
                  <span className="block text-xs text-muted">
                    {[c.publisher, c.year, c.language?.toUpperCase(), c.isbn13 ? `ISBN ${c.isbn13}` : null].filter(Boolean).join(' · ')}
                  </span>
                  <span className="mt-1 block text-xs text-muted">da {SOURCE[c.source]}</span>
                </span>
                {busy === c.candidate_token && <span className="text-sm text-muted">Salvo…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        <button type="button" onClick={() => setManual(true)} className="rounded-lg border border-line bg-surface px-3 py-2 text-ink">
          Non lo trovo: inserisco a mano
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="px-3 py-2 text-muted underline">Annulla</button>}
      </div>
    </div>
  );
}

function ManualBook({
  reviewId, getVersion, beforeChange, onSelected, onBack, initialTitle, initialAuthor,
}: {
  reviewId: string; getVersion: () => number; beforeChange: () => Promise<boolean>; onSelected: (s: EditorState) => void;
  onBack: () => void; initialTitle: string; initialAuthor: string;
}) {
  const [f, setF] = useState({ title: initialTitle, subtitle: '', authors: initialAuthor, publisher: '', year: '', isbn: '', language: 'it', pages: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (!(await beforeChange())) throw new Error('Salvataggio in corso, riprova tra un attimo.');
      const s = await api<EditorState>('/api/admin/books/manual', {
        method: 'POST',
        json: {
          review_id: reviewId, expected_version: getVersion(), title: f.title, subtitle: f.subtitle,
          authors: f.authors.split(',').map((a) => a.trim()).filter(Boolean), publisher: f.publisher,
          year: f.year ? Number(f.year) : null, isbn: f.isbn, language: f.language, page_count: f.pages ? Number(f.pages) : null,
        },
      });
      onSelected(s);
    } catch (err) {
      setError(err instanceof ApiFailure ? err.error.message : (err as Error).message);
    } finally { setBusy(false); }
  }

  const field = 'rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink';
  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm text-muted sm:col-span-2">Titolo *<input required value={f.title} onChange={set('title')} className={field} /></label>
      <label className="flex flex-col gap-1 text-sm text-muted sm:col-span-2">Autori * (separati da virgola)<input required value={f.authors} onChange={set('authors')} className={field} /></label>
      <label className="flex flex-col gap-1 text-sm text-muted">Sottotitolo<input value={f.subtitle} onChange={set('subtitle')} className={field} /></label>
      <label className="flex flex-col gap-1 text-sm text-muted">Editore<input value={f.publisher} onChange={set('publisher')} className={field} /></label>
      <label className="flex flex-col gap-1 text-sm text-muted">Anno dell’edizione<input inputMode="numeric" value={f.year} onChange={set('year')} className={field} /></label>
      <label className="flex flex-col gap-1 text-sm text-muted">ISBN<input inputMode="numeric" value={f.isbn} onChange={set('isbn')} className={field} /></label>
      <label className="flex flex-col gap-1 text-sm text-muted">Lingua (es. it, en)<input value={f.language} onChange={set('language')} className={field} /></label>
      <label className="flex flex-col gap-1 text-sm text-muted">Pagine<input inputMode="numeric" value={f.pages} onChange={set('pages')} className={field} /></label>
      {error && <p role="alert" className="text-danger sm:col-span-2">{error}</p>}
      <div className="flex gap-3 sm:col-span-2">
        <button disabled={busy} className="rounded-lg bg-accent-strong px-4 py-2.5 font-medium text-white disabled:opacity-60">{busy ? 'Salvo…' : 'Salva il libro'}</button>
        <button type="button" onClick={onBack} className="px-3 py-2 text-muted underline">Torna alla ricerca</button>
      </div>
      <p className="text-xs text-muted sm:col-span-2">La copertina potrai caricarla subito dopo, oppure pubblicare con il segnaposto.</p>
    </form>
  );
}
