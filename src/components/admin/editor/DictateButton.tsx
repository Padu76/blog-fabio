// E:\blog-fabio\src\components\admin\editor\DictateButton.tsx
// Pulsante "Detta": usa il riconoscimento vocale del browser (Chrome su Android e su computer), gratuito.
// Nessun audio viene registrato o salvato dal sito: arriva solo il testo, aggiunto in fondo alla recensione.
'use client';
import { useEffect, useRef, useState } from 'react';

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
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

export function DictateButton({
  onText, onInterim, className = '',
}: { onText: (text: string) => void; onInterim?: (text: string) => void; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const lastFinalRef = useRef('');
  const onTextRef = useRef(onText);
  const onInterimRef = useRef(onInterim);
  onTextRef.current = onText;
  onInterimRef.current = onInterim;

  useEffect(() => {
    setSupported(Boolean(getCtor()));
    return () => { wantRef.current = false; recRef.current?.abort(); };
  }, []);

  function showInterim(text: string) {
    setInterim(text);
    onInterimRef.current?.(text);
  }

  function begin() {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'it-IT';
    // Su Android la modalità continua di Chrome ripete più volte le stesse frasi: lì si ascolta una frase
    // alla volta e si riparte subito. Su computer la modalità continua è più fluida.
    const android = /Android/i.test(navigator.userAgent);
    rec.continuous = !android;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          // difesa contro i doppioni: la stessa frase definitiva non si aggiunge due volte di fila
          if (text.trim() && text.trim() !== lastFinalRef.current) {
            lastFinalRef.current = text.trim();
            onTextRef.current(text);
          }
        } else {
          live += text;
        }
      }
      showInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      wantRef.current = false;
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Il microfono non è autorizzato: consenti l’uso del microfono per questo sito e riprova.'
        : e.error === 'audio-capture' ? 'Non trovo un microfono.'
        : e.error === 'network' ? 'La dettatura ha bisogno di internet: controlla la connessione e riprova.'
        : 'La dettatura si è interrotta. Tocca di nuovo “Detta”.');
    };
    rec.onend = () => {
      showInterim('');
      // il browser chiude da solo dopo ogni pausa: finché non si preme "Ferma" si riparte subito
      if (wantRef.current) {
        lastFinalRef.current = '';
        try { begin(); return; } catch { /* si ferma */ }
      }
      wantRef.current = false;
      setListening(false);
    };
    recRef.current = rec;
    rec.start();
  }

  function start() {
    setError(null);
    lastFinalRef.current = '';
    wantRef.current = true;
    try { begin(); setListening(true); } catch { wantRef.current = false; }
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
        className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 font-medium ${listening ? 'bg-danger text-white' : 'bg-accent-strong text-white'} ${className}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        {listening ? 'Ferma la dettatura' : 'Detta'}
      </button>
      {listening && (
        <span role="status" className="basis-full text-sm text-muted">
          <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-danger align-middle" aria-hidden="true" />
          Ti ascolto… {!onInterim && interim && <em className="text-ink">{interim}</em>}
        </span>
      )}
      {error && <span role="alert" className="basis-full text-sm text-danger">{error}</span>}
    </>
  );
}

// Punteggiatura detta a voce. "punto" da solo NON si converte: nelle recensioni è una parola comune
// ("a questo punto", "punto di vista"); il punto fermo lo mette "Sistema il testo".
const SPOKEN: [RegExp, string][] = [
  [/\s*\bpunto e a capo\b\s*/gi, '.\n\n'],
  [/\s*\bpunto a capo\b\s*/gi, '.\n\n'],
  [/\s*\b(?:a capo|nuovo paragrafo|nuova riga)\b\s*/gi, '\n\n'],
  [/\s*\bpunto interrogativo\b/gi, '?'],
  [/\s*\bpunto esclamativo\b/gi, '!'],
  [/\s*\bpunto e virgola\b/gi, ';'],
  [/\s*\bdue punti\b/gi, ':'],
  [/\s*\bpuntini di sospensione\b/gi, '…'],
  [/\s*\bvirgola\b/gi, ','],
  [/\bapr[ie] (?:le )?virgolette\b\s*/gi, '“'],
  [/\s*\bchiud[ie] (?:le )?virgolette\b/gi, '”'],
];

function cap(t: string) { return t.charAt(0).toUpperCase() + t.slice(1); }

/** Aggiunge il testo dettato in fondo: punteggiatura a voce, spazi giusti, maiuscola a inizio frase. */
export function appendDictated(current: string, spoken: string) {
  let t = spoken.trim();
  if (!t) return current;
  for (const [re, to] of SPOKEN) t = t.replace(re, to);
  t = t.replace(/[ \t]+([,.;:!?…”])/g, '$1').replace(/([.!?…]\s+|\n\n)(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase());
  const endsWithBreak = /\n\s*$/.test(current);
  const base = current.replace(/[ \t]+$/, '');
  if (!base.trim()) return cap(t.replace(/^\s+/, ''));
  if (/^[,.;:!?…”]/.test(t)) return base.replace(/\s+$/, '') + t;
  if (/^\n/.test(t)) return base.replace(/\s+$/, '') + t;
  const startsSentence = endsWithBreak || /[.!?…]$/.test(base);
  const text = startsSentence ? cap(t) : t;
  return endsWithBreak ? current + text : `${base} ${text}`;
}
