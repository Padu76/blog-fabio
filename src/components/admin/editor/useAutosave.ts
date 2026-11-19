// E:\blog-fabio\src\components\admin\editor\useAutosave.ts
// Autosalvataggio dopo ~1,2 s di pausa, con versione attesa (409 se cambiata altrove), copia locale di sicurezza,
// salvataggio "keepalive" quando la pagina viene chiusa o messa in background. Non tocca mai il campo di testo:
// aggiorna solo la versione, così la tastiera e il cursore restano dove sono.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiFailure } from '@/lib/api';
import type { EditorState, WorkingFields } from '@/shared/review';
import { removeLocalDraft, writeLocalDraft } from '@/components/admin/localDraft';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'offline' | 'conflict' | 'error';

const DEBOUNCE_MS = 1200;

export function sameFields(a: WorkingFields, b: WorkingFields) {
  return a.body === b.body && a.spoiler_body === b.spoiler_body && a.has_spoilers === b.has_spoilers
    && a.excerpt === b.excerpt && a.rating === b.rating && a.private_notes === b.private_notes
    && JSON.stringify(a.tags) === JSON.stringify(b.tags);
}

export function useAutosave(reviewId: string, initialVersion: number, getFields: () => WorkingFields) {
  const versionRef = useRef(initialVersion);
  const dirtyRef = useRef(false);
  const conflictRef = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeCounter = useRef(0);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [conflict, setConflict] = useState<EditorState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const doSave = useCallback(async () => {
    if (!dirtyRef.current || conflictRef.current) return;
    const sentCounter = changeCounter.current;
    const fields = getFields();
    setStatus('saving');
    try {
      const r = await api<{ version: number }>(`/api/admin/reviews/${reviewId}`, {
        method: 'PATCH', json: { expected_version: versionRef.current, fields },
      });
      versionRef.current = r.version;
      if (changeCounter.current === sentCounter) {
        dirtyRef.current = false;
        removeLocalDraft(reviewId);
        setStatus('saved');
      } else {
        setStatus('dirty');
      }
      setErrorMsg(null);
    } catch (e) {
      if (e instanceof ApiFailure && e.error.code === 'REVISION_CONFLICT') {
        const current = e.error.current as EditorState | undefined;
        // il salvataggio "keepalive" di prima era già arrivato: stessa sostanza, nessun vero conflitto
        if (current && sameFields(current.fields, getFields())) {
          versionRef.current = current.version;
          dirtyRef.current = changeCounter.current !== sentCounter;
          setStatus(dirtyRef.current ? 'dirty' : 'saved');
          return;
        }
        conflictRef.current = true;
        setConflict(current ?? null);
        setStatus('conflict');
      } else if (e instanceof ApiFailure && e.status === 0) {
        setStatus('offline');
      } else if (e instanceof ApiFailure && e.status === 401) {
        setStatus('error');
        setErrorMsg('Sessione scaduta: il testo è salvato su questo telefono. Accedi di nuovo in un’altra scheda e torna qui.');
      } else {
        setStatus('error');
        setErrorMsg(e instanceof ApiFailure ? e.error.message : 'Salvataggio non riuscito.');
      }
    }
  }, [reviewId, getFields]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    while (inFlight.current) await inFlight.current;
    if (dirtyRef.current && !conflictRef.current) {
      inFlight.current = doSave().finally(() => { inFlight.current = null; });
      await inFlight.current;
    }
    return !dirtyRef.current && !conflictRef.current;
  }, [doSave]);

  const markChanged = useCallback(() => {
    dirtyRef.current = true;
    changeCounter.current += 1;
    if (!conflictRef.current) setStatus('dirty');
    writeLocalDraft(reviewId, { fields: getFields(), baseVersion: versionRef.current, savedAt: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, DEBOUNCE_MS);
  }, [reviewId, getFields, flush]);

  useEffect(() => {
    const online = () => { if (dirtyRef.current) void flush(); };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [flush]);

  useEffect(() => {
    const leave = () => {
      if (!dirtyRef.current || conflictRef.current) return;
      const fields = getFields();
      writeLocalDraft(reviewId, { fields, baseVersion: versionRef.current, savedAt: Date.now() });
      if (inFlight.current) return; // c'è già un salvataggio in corso
      const body = JSON.stringify({ expected_version: versionRef.current, fields });
      if (body.length < 60_000) {
        fetch(`/api/admin/reviews/${reviewId}`, {
          method: 'PATCH', body, keepalive: true, credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => null);
      }
    };
    const vis = () => {
      if (document.visibilityState === 'hidden') leave();
      else if (dirtyRef.current) void flush();
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', leave);
    };
  }, [reviewId, getFields, flush]);

  /** Dopo un conflitto: tieni la mia versione (sostituisce quella salvata altrove). */
  const keepMine = useCallback(async () => {
    if (!conflict) return;
    versionRef.current = conflict.version;
    conflictRef.current = false;
    setConflict(null);
    dirtyRef.current = true;
    changeCounter.current += 1;
    await flush();
  }, [conflict, flush]);

  /** Dopo un conflitto: usa la versione salvata altrove. */
  const takeServer = useCallback(() => {
    if (!conflict) return null;
    versionRef.current = conflict.version;
    dirtyRef.current = false;
    conflictRef.current = false;
    const s = conflict;
    setConflict(null);
    removeLocalDraft(reviewId);
    setStatus('saved');
    return s;
  }, [conflict, reviewId]);

  const setVersion = useCallback((v: number) => { versionRef.current = v; }, []);
  const getVersion = useCallback(() => versionRef.current, []);

  return { status, errorMsg, conflict, markChanged, flush, keepMine, takeServer, setVersion, getVersion };
}
