// E:\blog-fabio\src\components\admin\editor\DictateButton.tsx
// Pulsante "Detta": usa il riconoscimento vocale del browser (Chrome su Android e su computer), gratuito.
// Nessun audio viene registrato o salvato dal sito: arriva solo il testo, aggiunto in fondo alla recensione.
'use client';
import { useEffect, useRef, useState } from 'react';

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function DictateButton({ onText, className = '' }: { onText: (text: string) => void; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(Boolean(getCtor()));
    return () => { wantRef.current = false; recRef.current?.abort(); };
  }, []);

  function start() {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = 'it-IT';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onTextRef.current(r[0].transcript);
        else live += r[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      wantRef.current = false;
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Il microfono non è autorizzato: consenti l’uso del microfono per questo sito e riprova.'
        : e.error === 'audio-capture' ? 'Non trovo un microfono.'
        : 'La dettatura si è interrotta. Tocca di nuovo “Detta”.');
    };
    rec.onend = () => {
      setInterim('');
      // il browser chiude da solo dopo una pausa: finché Fabio non preme "Ferma" si riparte
      if (wantRef.current) { try { rec.start(); return; } catch { /* si ferma */ } }
      wantRef.current = false;
      setListening(false);
    };
    recRef.current = rec;
    wantRef.current = true;
    try { rec.start(); setListening(true); } catch { wantRef.current = false; }
  }

  function stop() {
    wantRef.current = false;
    recRef.current?.stop();
    setListening(false);
  }

  if (!supported) return null;
  return (
    <>
      <button
        type="button" onClick={listening ? stop : start} aria-pressed={listening}
        className={`inline-flex items-center gap-2 rounded-md px-4 py-2 font-medium ${listening ? 'bg-danger text-white' : 'bg-accent-strong text-white'} ${className}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        {listening ? 'Ferma la dettatura' : 'Detta'}
      </button>
      {listening && (
        <span role="status" className="basis-full text-sm text-muted">
          <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-danger align-middle" aria-hidden="true" />
          Ti ascolto… {interim && <em className="text-ink">{interim}</em>}
        </span>
      )}
      {error && <span role="alert" className="basis-full text-sm text-danger">{error}</span>}
    </>
  );
}

/** Aggiunge il testo dettato in fondo, con uno spazio e la maiuscola dopo un punto. */
export function appendDictated(current: string, spoken: string) {
  const t = spoken.trim();
  if (!t) return current;
  const base = current.replace(/[ \t]+$/, '');
  if (!base) return t.charAt(0).toUpperCase() + t.slice(1);
  const startsSentence = /[.!?…]\s*$/.test(base) || /\n\s*$/.test(current);
  const text = startsSentence ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  return /\n\s*$/.test(current) ? current + text : `${base} ${text}`;
}
