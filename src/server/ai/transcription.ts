// E:\blog-fabio\src\server\ai\transcription.ts
// PREDISPOSIZIONE (non attiva): trascrizione audio → testo. Funzione futura dietro FEATURE_AUDIO=false.
// Quando Andrea la attiverà: usare il modello di trascrizione OpenAI in vigore in quel momento, verificandolo
// sulla documentazione ufficiale (whisper-1 è deprecato, dismissione 26 febbraio 2027). Chiave: OPENAI_API_KEY.
// Nessun registratore, upload o worker è implementato nel P0.
import 'server-only';
import { serverEnv } from '@/lib/env';

export type TranscriptionInput = {
  /** file audio già validato (MP3, M4A/MP4, WAV, WebM), massimo 20 MB */
  audio: Blob;
  fileName: string;
  /** contesto facoltativo: titolo e autore confermati, per aiutare con i nomi propri */
  context?: { title?: string; authors?: string[] };
  language?: 'it';
};

export type TranscriptionResult = {
  text: string;
  provider: 'openai';
  model: string;
  /** frammenti da verificare (es. nomi capiti male) */
  uncertain: string[];
};

export interface TranscriptionAdapter {
  readonly enabled: boolean;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

class DisabledTranscription implements TranscriptionAdapter {
  readonly enabled = false;
  async transcribe(): Promise<TranscriptionResult> {
    throw new Error('Trascrizione audio non attiva (FEATURE_AUDIO=false).');
  }
}

export function getTranscriptionAdapter(): TranscriptionAdapter {
  const env = serverEnv();
  if (!env.featureAudio || !env.openaiKey) return new DisabledTranscription();
  // Da implementare all'attivazione: chiamata sincrona al modello OpenAI corrente, con timeout,
  // registrazione dei consumi in bfb_ai_usage (operation = 'transcribe') e testo restituito come proposta.
  return new DisabledTranscription();
}
