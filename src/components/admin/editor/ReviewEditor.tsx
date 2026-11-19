// E:\blog-fabio\src\components\admin\editor\ReviewEditor.tsx
// Editor della recensione, pensato per lo smartphone e la dettatura della tastiera Google:
// area di testo grande (anche a tutto schermo), autosalvataggio, nessun elemento che rubi il focus.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiFailure, shrinkImage, uploadImage } from '@/lib/api';
import type { EditorState, RevisionInfo, SuggestionInfo, WorkingFields } from '@/shared/review';
import { formatRating } from '@/shared/review';
import { Cover } from '@/components/Cover';
import { readLocalDraft, removeLocalDraft } from '@/components/admin/localDraft';
import { sameFields, useAutosave, type SaveStatus } from './useAutosave';
import { BookPicker } from './BookPicker';
import { RatingPicker } from './RatingPicker';
import { AiSuggestion } from './AiSuggestion';
import { History } from './History';
import { DictateButton, appendDictated } from './DictateButton';

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'Salvato', dirty: 'Modifiche…', saving: 'Salvataggio…', offline: 'Connessione assente: salvato sul telefono',
  conflict: 'Conflitto', error: 'Non salvato',
};
const SOURCE: Record<string, string> = { google_books: 'Google Books', open_library: 'Open Library', manual: 'inserito a mano' };

function excerptFrom(body: string) {
  const text = body.replace(/\s+/g, ' ').trim();
  if (text.length <= 240) return text;
  const cut = text.slice(0, 240);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

export function ReviewEditor({ initial }: { initial: EditorState }) {
  const router = useRouter();
  const [doc, setDoc] = useState<EditorState>(initial);
  const [fields, setFields] = useState<WorkingFields>(initial.fields);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const getFields = useCallback(() => fieldsRef.current, []);
  const saver = useAutosave(initial.id, initial.version, getFields);

  const [pickBook, setPickBook] = useState(!initial.book);
  const [focusMode, setFocusMode] = useState(false);
  const [tagsText, setTagsText] = useState(initial.fields.tags.join(', '));
  const [suggestions, setSuggestions] = useState<SuggestionInfo[]>([]);
  const [revisions, setRevisions] = useState<RevisionInfo[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [localCopy, setLocalCopy] = useState<WorkingFields | null>(null);
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [needPlaceholderOk, setNeedPlaceholderOk] = useState(false);
  const publishKey = useRef<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const loadSide = useCallback(async () => {
    try {
      const r = await api<{ revisions: RevisionInfo[]; suggestions: SuggestionInfo[] }>(`/api/admin/reviews/${initial.id}/revisions`);
      setRevisions(r.revisions); setSuggestions(r.suggestions);
    } catch { /* non bloccante */ }
  }, [initial.id]);

  useEffect(() => {
    void loadSide();
    const local = readLocalDraft(initial.id);
    if (local && local.savedAt > new Date(initial.updated_at).getTime() && !sameFields(local.fields, initial.fields)) {
      setLocalCopy(local.fields);
    } else if (local) {
      removeLocalDraft(initial.id);
    }
  }, [initial.id, initial.updated_at, initial.fields, loadSide]);

  // testo dettato: si aggiunge in fondo alla recensione
  function onDictated(spoken: string) {
    update('body', appendDictated(fieldsRef.current.body, spoken));
  }

  function update<K extends keyof WorkingFields>(k: K, v: WorkingFields[K]) {
    const next = { ...fieldsRef.current, [k]: v };
    fieldsRef.current = next;
    setFields(next);
    saver.markChanged();
  }

  function applyState(s: EditorState) {
    setDoc(s);
    saver.setVersion(s.version);
  }

  function replaceFields(f: WorkingFields) {
    fieldsRef.current = f;
    setFields(f);
    setTagsText(f.tags.join(', '));
  }

  async function onBookSelected(s: EditorState) {
    applyState(s);
    setPickBook(false);
    setNotice(s.other_reviews_of_book > 0 ? { kind: 'info', text: 'Attenzione: hai già un’altra recensione di questo libro.' } : null);
  }

  async function uploadCover(file: File) {
    setNotice(null);
    try {
      if (!(await saver.flush())) throw new Error('Salvataggio in corso, riprova tra un attimo.');
      const blob = await shrinkImage(file, 1200);
      const s = await uploadImage<EditorState>(`/api/admin/reviews/${doc.id}/cover`, blob);
      applyState(s);
      setNotice({ kind: 'info', text: 'Copertina caricata.' });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof ApiFailure ? e.error.message : (e as Error).message });
    }
  }

  async function askAi(field: 'body' | 'spoiler_body') {
    if (aiBusy) return;
    setAiBusy(true); setNotice(null);
    try {
      if (!(await saver.flush())) throw new Error('Salvataggio in corso, riprova tra un attimo.');
      const r = await api<{ suggestion: SuggestionInfo | null; message?: string }>(`/api/admin/reviews/${doc.id}/fix-text`, {
        method: 'POST', json: { field, expected_version: saver.getVersion() },
      });
      if (r.suggestion) setSuggestions((s) => [r.suggestion!, ...s.filter((x) => x.field !== field)]);
      else setNotice({ kind: 'info', text: r.message ?? 'Nessuna correzione necessaria.' });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof ApiFailure ? e.error.message : (e as Error).message });
    } finally {
      setAiBusy(false);
    }
  }

  async function decide(s: SuggestionInfo, action: 'accept' | 'discard') {
    setAiBusy(true); setNotice(null);
    try {
      if (action === 'accept' && !(await saver.flush())) throw new Error('Salvataggio in corso, riprova tra un attimo.');
      const r = await api<{ status: string; state?: EditorState }>(`/api/admin/suggestions/${s.id}`, {
        method: 'POST', json: { action, expected_version: saver.getVersion() },
      });
      setSuggestions((list) => list.filter((x) => x.id !== s.id));
      if (r.state) {
        applyState(r.state);
        replaceFields(r.state.fields);
        setNotice({ kind: 'info', text: 'Testo corretto applicato. Il tuo testo originale è nella cronologia.' });
        void loadSide();
      }
    } catch (e) {
      if (e instanceof ApiFailure && e.error.code === 'SUGGESTION_STALE') setSuggestions((list) => list.filter((x) => x.id !== s.id));
      setNotice({ kind: 'error', text: e instanceof ApiFailure ? e.error.message : (e as Error).message });
    } finally {
      setAiBusy(false);
    }
  }

  const checklist = [
    { ok: Boolean(doc.book), text: 'Libro scelto' },
    { ok: fields.body.trim().length > 0, text: 'Testo della recensione' },
    { ok: fields.rating !== null, text: 'Voto' },
    { ok: fields.excerpt.trim().length > 0, text: 'Estratto senza spoiler' },
    { ok: !fields.has_spoilers || fields.spoiler_body.trim().length > 0, text: 'Sezione spoiler (se attiva) compilata' },
    { ok: Boolean(doc.edition?.cover_url) || doc.placeholder_ok || needPlaceholderOk, text: 'Copertina (o segnaposto accettato)' },
  ];
  const ready = checklist.every((c) => c.ok);

  async function publish() {
    if (publishing) return;
    setPublishing(true); setNotice(null);
    try {
      if (!(await saver.flush())) throw new Error('Non riesco a salvare l’ultima modifica: controlla la connessione e riprova.');
      publishKey.current ??= crypto.randomUUID();
      const r = await api<{ url: string; slug: string }>(`/api/admin/reviews/${doc.id}/publish`, {
        method: 'POST',
        json: { expected_version: saver.getVersion(), confirm_placeholder: needPlaceholderOk, idempotency_key: publishKey.current },
      });
      publishKey.current = null;
      const s = await api<EditorState>(`/api/admin/reviews/${doc.id}`);
      applyState(s);
      void loadSide();
      setNotice({ kind: 'info', text: `Pubblicata! È online su ${r.url}` });
    } catch (e) {
      if (e instanceof ApiFailure && e.error.code === 'COVER_UNAVAILABLE') setNeedPlaceholderOk(false);
      if (e instanceof ApiFailure && e.error.code === 'REVISION_CONFLICT') publishKey.current = null;
      setNotice({ kind: 'error', text: e instanceof ApiFailure ? e.error.message : (e as Error).message });
    } finally {
      setPublishing(false);
    }
  }

  async function stateAction(action: 'unpublish' | 'archive' | 'unarchive') {
    const q = action === 'unpublish' ? 'Ritirare la recensione dal sito? Il testo resta salvato qui.'
      : action === 'archive' ? 'Archiviare la recensione? Se è online verrà ritirata.' : null;
    if (q && !window.confirm(q)) return;
    setNotice(null);
    try {
      await api(`/api/admin/reviews/${doc.id}/unpublish`, { method: 'POST', json: { action } });
      const s = await api<EditorState>(`/api/admin/reviews/${doc.id}`);
      applyState(s);
      setNotice({ kind: 'info', text: action === 'unpublish' ? 'Ritirata dal sito.' : action === 'archive' ? 'Archiviata.' : 'Riportata tra le bozze.' });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof ApiFailure ? e.error.message : 'Operazione non riuscita.' });
    }
  }

  async function remove() {
    if (!window.confirm('Eliminare definitivamente questa recensione e la sua cronologia? Non si può annullare.')) return;
    try {
      await api(`/api/admin/reviews/${doc.id}`, { method: 'DELETE' });
      removeLocalDraft(doc.id);
      router.replace('/admin');
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof ApiFailure ? e.error.message : 'Eliminazione non riuscita.' });
    }
  }

  async function restore(r: RevisionInfo) {
    if (!window.confirm('Rimettere questo testo nella bozza? Il testo attuale viene prima salvato nella cronologia.')) return;
    try {
      if (!(await saver.flush())) throw new Error('Salvataggio in corso, riprova tra un attimo.');
      await api(`/api/admin/reviews/${doc.id}/revisions`, { method: 'POST', json: {} });
      update('body', r.body);
      void loadSide();
      setNotice({ kind: 'info', text: 'Testo ripristinato nella bozza. Quello di prima è nella cronologia.' });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof ApiFailure ? e.error.message : (e as Error).message });
    }
  }

  const statusPill = (
    <span role="status" aria-live="polite"
      className={`rounded-full px-2.5 py-1 text-xs ${saver.status === 'saved' ? 'bg-accent-soft text-accent-strong' : saver.status === 'error' || saver.status === 'conflict' ? 'bg-[#f3dada] text-danger' : 'bg-surface text-muted'}`}>
      {STATUS_TEXT[saver.status]}
    </span>
  );
  const bookTitle = doc.book?.title ?? 'Nuova recensione';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-serif text-2xl italic text-ink">{bookTitle}</h1>
        <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">
          {doc.state === 'published' ? 'Online' : doc.state === 'archived' ? 'Archiviata' : 'Bozza'}
        </span>
        {statusPill}
      </div>

      {doc.state === 'published' && (
        <p className="rounded-lg bg-accent-soft/60 p-3 text-sm text-ink">
          Sul sito resta la versione pubblicata. Le modifiche che fai qui sono private finché non premi “Pubblica aggiornamento”.
          {doc.slug && <> <a href={`/recensioni/${doc.slug}`} target="_blank" className="underline">Vedi online</a></>}
        </p>
      )}

      {saver.errorMsg && <p role="alert" className="rounded-lg border border-danger/40 bg-surface p-3 text-danger">{saver.errorMsg}</p>}

      {saver.conflict && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-surface p-3 text-sm">
          <p className="text-ink">Questa bozza è stata modificata in un’altra scheda o su un altro dispositivo. Quale versione vuoi tenere?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => void saver.keepMine()} className="rounded-md bg-accent-strong px-3 py-2 text-white">Tieni quella che vedo qui</button>
            <button onClick={() => { const s = saver.takeServer(); if (s) { applyState(s); replaceFields(s.fields); } }} className="rounded-md border border-line px-3 py-2">Usa quella salvata</button>
          </div>
        </div>
      )}

      {localCopy && (
        <div role="alert" className="rounded-lg border border-accent bg-surface p-3 text-sm">
          <p className="text-ink">Ho trovato su questo telefono un testo più recente, non ancora salvato online.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => { replaceFields(localCopy); saver.markChanged(); setLocalCopy(null); }} className="rounded-md bg-accent-strong px-3 py-2 text-white">Ripristina il testo del telefono</button>
            <button onClick={() => { removeLocalDraft(doc.id); setLocalCopy(null); }} className="rounded-md border border-line px-3 py-2">Ignora</button>
          </div>
        </div>
      )}

      {notice && (
        <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${notice.kind === 'error' ? 'border border-danger/40 bg-surface text-danger' : 'bg-accent-soft/60 text-ink'}`}>
          {notice.text}
        </p>
      )}

      {/* 1. LIBRO */}
      <section aria-labelledby="sec-libro" className="rounded-xl border border-line bg-surface p-4">
        <h2 id="sec-libro" className="text-sm font-semibold uppercase tracking-wide text-muted">1 · Libro</h2>
        {doc.book && !pickBook ? (
          <div className="mt-3 flex gap-4">
            <Cover url={doc.edition?.cover_url ?? null} title={doc.book.title} authors={doc.book.authors} className="w-24" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-serif text-xl italic text-ink">{doc.book.title}</p>
              <p className="text-ink">{doc.book.authors.join(', ')}</p>
              <p className="mt-1 text-muted">
                {[doc.edition?.publisher, doc.edition?.year, doc.edition?.isbn13 ? `ISBN ${doc.edition.isbn13}` : null].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-muted">
                Scheda: {SOURCE[doc.edition?.provider ?? 'manual']}
                {doc.edition?.cover_url ? ` · copertina: ${doc.edition.cover_mode === 'uploaded' ? 'caricata da te' : doc.edition.cover_attribution}` : ' · senza copertina'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPickBook(true)} className="rounded-md border border-line px-3 py-1.5 text-ink">Cambia libro o edizione</button>
                <button type="button" onClick={() => coverInput.current?.click()} className="rounded-md border border-line px-3 py-1.5 text-ink">Carica copertina</button>
                <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadCover(f); }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <BookPicker reviewId={doc.id} getVersion={saver.getVersion} beforeChange={saver.flush} onSelected={onBookSelected}
              onCancel={doc.book ? () => setPickBook(false) : undefined} />
          </div>
        )}
      </section>

      {/* 2. RACCONTA */}
      <section aria-labelledby="sec-testo" className="rounded-xl border border-line bg-surface p-4">
        <h2 id="sec-testo" className="text-sm font-semibold uppercase tracking-wide text-muted">2 · Racconta</h2>
        <details className="mt-2 text-sm text-muted">
          <summary className="cursor-pointer">Qualche spunto (facoltativo)</summary>
          <ul className="mt-1 list-disc pl-5">
            <li>Cosa ti ha colpito?</li><li>A chi lo consiglieresti?</li><li>Cosa non ti ha convinto?</li>
          </ul>
          <p className="mt-1">Per dettare: premi “Detta” e parla, il testo si aggiunge in fondo. In alternativa usa il microfono sulla tastiera del telefono. La punteggiatura la sistema poi “Sistema il testo”.</p>
        </details>

        <div className={focusMode ? 'fixed inset-0 z-50 flex flex-col bg-bg p-3' : 'mt-3'}>
          {focusMode ? (
            <div className="mb-2 flex items-center gap-2">
              {statusPill}
              <span className="text-xs text-muted">{fields.body.trim() ? fields.body.trim().split(/\s+/).length : 0} parole</span>
              <span className="ml-auto" />
              <DictateButton onText={onDictated} />
              <button type="button" onClick={() => setFocusMode(false)} className="rounded-md border border-accent-strong px-4 py-2 text-accent-strong">Fine</button>
            </div>
          ) : null}
          <label htmlFor="body" className={focusMode ? 'sr-only' : 'sr-only'}>Testo della recensione</label>
          <textarea
            id="body"
            value={fields.body}
            onChange={(e) => update('body', e.target.value)}
            placeholder="Scrivi o detta qui la tua recensione…"
            spellCheck
            lang="it"
            autoCapitalize="sentences"
            className={`w-full resize-y rounded-lg border border-line bg-bg p-3 font-serif text-[1.15rem] leading-relaxed text-ink [field-sizing:content] focus:border-accent ${focusMode ? 'min-h-0 flex-1 resize-none' : 'min-h-[55vh]'}`}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!focusMode && <DictateButton onText={onDictated} />}
          <button type="button" onClick={() => setFocusMode(true)} className="rounded-md border border-line px-3 py-2 text-ink">Scrivi a tutto schermo</button>
          <button type="button" disabled={aiBusy || fields.body.trim().length < 20} onClick={() => void askAi('body')}
            className="rounded-md border border-accent bg-accent-soft px-3 py-2 font-medium text-accent-strong disabled:opacity-50">
            {aiBusy ? 'Sistemo…' : 'Sistema il testo'}
          </button>
          <span className="text-xs text-muted">{fields.body.trim() ? fields.body.trim().split(/\s+/).length : 0} parole</span>
        </div>
        <p className="mt-1 text-xs text-muted">“Detta” scrive quello che dici, senza punteggiatura. “Sistema il testo” corregge solo punteggiatura, maiuscole e parole capite male: ti mostra le differenze e decidi tu.</p>

        {suggestions.filter((s) => s.field === 'body').map((s) => (
          <div key={s.id} className="mt-4"><AiSuggestion s={s} busy={aiBusy} onAccept={() => void decide(s, 'accept')} onDiscard={() => void decide(s, 'discard')} /></div>
        ))}

        <div className="mt-6 border-t border-line pt-4">
          <label className="flex items-center gap-3 text-ink">
            <input type="checkbox" checked={fields.has_spoilers} onChange={(e) => update('has_spoilers', e.target.checked)} className="h-5 w-5 accent-[#345A6C]" />
            Voglio aggiungere una parte con spoiler (resterà nascosta finché il lettore non la apre)
          </label>
          {fields.has_spoilers && (
            <>
              <label htmlFor="spoiler" className="mt-3 block text-sm text-muted">Parte con spoiler</label>
              <textarea id="spoiler" value={fields.spoiler_body} onChange={(e) => update('spoiler_body', e.target.value)}
                lang="it" autoCapitalize="sentences"
                className="mt-1 min-h-40 w-full rounded-lg border border-danger/40 bg-bg p-3 font-serif text-[1.1rem] leading-relaxed text-ink [field-sizing:content]" />
              <button type="button" disabled={aiBusy || fields.spoiler_body.trim().length < 20} onClick={() => void askAi('spoiler_body')}
                className="mt-2 rounded-md border border-accent bg-accent-soft px-3 py-2 text-sm text-accent-strong disabled:opacity-50">Sistema la parte spoiler</button>
              {suggestions.filter((s) => s.field === 'spoiler_body').map((s) => (
                <div key={s.id} className="mt-4"><AiSuggestion s={s} busy={aiBusy} onAccept={() => void decide(s, 'accept')} onDiscard={() => void decide(s, 'discard')} /></div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* 3. COMPLETA */}
      <section aria-labelledby="sec-completa" className="space-y-5 rounded-xl border border-line bg-surface p-4">
        <h2 id="sec-completa" className="text-sm font-semibold uppercase tracking-wide text-muted">3 · Completa</h2>
        <div>
          <p className="mb-2 font-medium text-ink">Il tuo voto</p>
          <RatingPicker value={fields.rating} onChange={(v) => update('rating', v)} />
        </div>
        <div>
          <label htmlFor="excerpt" className="font-medium text-ink">Estratto (si vede nelle anteprime, senza spoiler)</label>
          <textarea id="excerpt" value={fields.excerpt} maxLength={600} onChange={(e) => update('excerpt', e.target.value)} lang="it"
            className="mt-1 min-h-24 w-full rounded-lg border border-line bg-bg p-3 font-serif text-[1.05rem] text-ink [field-sizing:content]" />
          <div className="flex items-center gap-3 text-xs text-muted">
            <button type="button" onClick={() => update('excerpt', excerptFrom(fields.body))} disabled={!fields.body.trim()} className="text-accent-strong underline disabled:opacity-50">
              Prendi l’inizio del testo
            </button>
            <span className="ml-auto">{fields.excerpt.length}/600</span>
          </div>
        </div>
        <div>
          <label htmlFor="tags" className="font-medium text-ink">Temi (facoltativi, separati da virgola)</label>
          <input id="tags" value={tagsText} placeholder="es. romanzo, memoria, viaggio"
            onChange={(e) => { setTagsText(e.target.value); update('tags', e.target.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12)); }}
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink" />
        </div>
        <div>
          <label htmlFor="notes" className="font-medium text-ink">Note private (non vanno mai online)</label>
          <textarea id="notes" value={fields.private_notes} onChange={(e) => update('private_notes', e.target.value)}
            className="mt-1 min-h-16 w-full rounded-lg border border-line bg-bg p-3 text-ink [field-sizing:content]" />
        </div>
      </section>

      {/* 4. PUBBLICA */}
      <section aria-labelledby="sec-pubblica" className="rounded-xl border border-line bg-surface p-4">
        <h2 id="sec-pubblica" className="text-sm font-semibold uppercase tracking-wide text-muted">4 · Pubblica</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {checklist.map((c) => (
            <li key={c.text} className={c.ok ? 'text-ink' : 'text-muted'}>
              <span aria-hidden="true" className={c.ok ? 'text-accent-strong' : 'text-danger'}>{c.ok ? '✓' : '○'}</span> {c.text}
              <span className="sr-only">{c.ok ? ' (fatto)' : ' (manca)'}</span>
            </li>
          ))}
        </ul>
        {doc.book && !doc.edition?.cover_url && !doc.placeholder_ok && (
          <label className="mt-3 flex items-center gap-3 text-sm text-ink">
            <input type="checkbox" checked={needPlaceholderOk} onChange={(e) => setNeedPlaceholderOk(e.target.checked)} className="h-5 w-5 accent-[#345A6C]" />
            Pubblica anche senza copertina (verrà mostrato un segnaposto con titolo e autore)
          </label>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => setPreview((p) => !p)} className="rounded-lg border border-line px-4 py-3 text-ink">
            {preview ? 'Chiudi anteprima' : 'Anteprima'}
          </button>
          <button type="button" disabled={!ready || publishing || (doc.state === 'published' && !doc.has_unpublished_changes && saver.status === 'saved')}
            onClick={() => void publish()}
            className="flex-1 rounded-lg bg-accent-strong px-4 py-3 text-lg font-medium text-white disabled:opacity-50 sm:flex-none">
            {publishing ? 'Pubblico…' : doc.state === 'published' ? 'Pubblica aggiornamento' : 'Approva e pubblica'}
          </button>
        </div>
        {doc.state === 'published' && !doc.has_unpublished_changes && saver.status === 'saved' && (
          <p className="mt-2 text-xs text-muted">Online c’è già esattamente questa versione.</p>
        )}

        {preview && (
          <div className="mt-5 rounded-lg border border-dashed border-accent bg-bg p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Anteprima privata</p>
            <div className="mt-3 flex gap-4">
              <Cover url={doc.edition?.cover_url ?? null} title={doc.book?.title ?? '—'} authors={doc.book?.authors ?? []} className="w-24" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{doc.book?.authors.join(', ')}</p>
                <p className="font-serif text-2xl italic text-ink">{doc.book?.title ?? 'Libro non scelto'}</p>
                <p className="mt-2 font-serif text-2xl text-accent-strong">{formatRating(fields.rating)} / 10</p>
              </div>
            </div>
            <p className="prose-review mt-4 border-l-4 border-accent pl-3 italic">{fields.excerpt || '(estratto mancante)'}</p>
            <div className="prose-review mt-4">
              {fields.body.split(/\n\s*\n/).filter((p) => p.trim()).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
            </div>
            {fields.has_spoilers && fields.spoiler_body.trim() && (
              <details className="mt-4 rounded-lg border border-danger/40 p-3"><summary className="text-danger">Sezione spoiler</summary>
                <div className="prose-review mt-2 whitespace-pre-line">{fields.spoiler_body}</div></details>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-4 text-sm">
          {doc.state === 'published' && <button type="button" onClick={() => void stateAction('unpublish')} className="rounded-md border border-danger/50 px-3 py-2 text-danger">Ritira dal sito</button>}
          {doc.state !== 'archived' && <button type="button" onClick={() => void stateAction('archive')} className="rounded-md border border-line px-3 py-2 text-ink">Archivia</button>}
          {doc.state === 'archived' && <button type="button" onClick={() => void stateAction('unarchive')} className="rounded-md border border-line px-3 py-2 text-ink">Riporta tra le bozze</button>}
          {doc.state !== 'published' && <button type="button" onClick={() => void remove()} className="rounded-md px-3 py-2 text-danger underline">Elimina definitivamente</button>}
        </div>
      </section>

      <section aria-labelledby="sec-storia" className="rounded-xl border border-line bg-surface p-4">
        <h2 id="sec-storia" className="text-sm font-semibold uppercase tracking-wide text-muted">Cronologia</h2>
        <div className="mt-3">
          <History revisions={revisions} onRestore={(r) => void restore(r)} />
        </div>
      </section>
    </div>
  );
}
