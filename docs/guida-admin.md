<!-- E:\blog-fabio\docs\guida-admin.md -->

# Guida amministrativa (Andrea)

## Servizi e costi
| Servizio | Uso | Costo |
|---|---|---|
| Vercel (progetto `blog-fabio`) | hosting del sito | piano gratuito, nessun add-on |
| Supabase UtilityLab (condiviso, ref `vzwplpljxdqmdejvzwuw`) | database, accesso, immagini | nessun costo aggiuntivo |
| Anthropic (`claude-haiku-5-5`) | solo “Sistema il testo” | pochi centesimi al mese: il pannello mostra la stima |
| Google Books, Open Library | catalogo e copertine | gratuiti |
| OpenAI | trascrizione audio futura | **spenta** (`FEATURE_AUDIO=false`) |

Nel database condiviso tutto ciò che appartiene al blog ha il prefisso **`bfb_`**: tabelle, funzioni e bucket `bfb-covers`/`bfb-media`. Il prefisso `bf_` è di un altro progetto: non toccarlo.

## Variabili d’ambiente (Vercel → Project → Settings → Environment Variables)
| Nome | Valore | Dove si trova |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL del sito, es. `https://blog-fabio.vercel.app` | — |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vzwplpljxdqmdejvzwuw.supabase.co` | — |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chiave `sb_publishable_…` | Supabase → Project Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | chiave segreta | Supabase → Project Settings → API Keys → Secret keys (o legacy `service_role`) |
| `ADMIN_BOOTSTRAP_EMAIL` | la tua email | serve solo per il primo accesso |
| `ANTHROPIC_API_KEY` | chiave API | console.anthropic.com → API Keys |
| `EDITORIAL_MODEL` | `claude-haiku-5-5` | — |
| `AI_DAILY_LIMIT` | `30` | tetto predefinito, modificabile dal pannello |
| `GOOGLE_BOOKS_API_KEY` | chiave gratuita | Google Cloud Console → API e servizi → abilita “Books API” → Credenziali → Crea chiave API |
| `FEATURE_AUDIO` | `false` | — |

Dopo aver cambiato una variabile serve un nuovo deploy: Vercel → Deployments → ultimo → **Redeploy**.

## Primo accesso e operatori
1. Imposta `ADMIN_BOOTSTRAP_EMAIL` con la tua email e fai il redeploy.
2. Apri `/admin`, inserisci quella email e usa il link ricevuto: diventi il primo amministratore. Il bootstrap funziona solo finché non esiste nessun operatore.
3. Da **Impostazioni → Chi può entrare** aggiungi l’email di Fabio (ruolo *amministratore* se deve gestire anche le impostazioni).
   Poi premi **Nuova password** accanto al suo nome: la password compare una sola volta, copiala e dagliela. Fabio entra con la sola password e può cambiarla da **Il mio accesso**. Nessuno può rileggerla: se la dimentica, **Nuova password** ne crea un’altra.
4. Per togliere l’accesso a qualcuno: **Disattiva**.

Gli utenti di Supabase Auth sono condivisi con gli altri progetti: un account esistente non entra nel blog se non è in `bfb_admins`.

**Supabase Auth: impostazioni da verificare una volta** (dashboard → Authentication):
- *URL Configuration → Redirect URLs*: aggiungi `https://<dominio-del-sito>/auth/callback`. Senza questo, il link dell’email porta al sito sbagliato.
- *Emails*: l’invio predefinito di Supabase ha limiti molto bassi e può consegnare solo agli indirizzi del team. Se il link non arriva a Fabio, serve un SMTP personalizzato già configurato per UtilityLab (gli altri progetti probabilmente lo usano già).

## Sito in anteprima
In **Impostazioni → Chi vede il sito** c’è l’interruttore. In anteprima i visitatori vedono solo la pagina “Lo scaffale si sta riempiendo”, il sito non compare su Google e solo chi è entrato vede le recensioni. **Rendi il sito pubblico** lo apre a tutti; il cambio vale entro pochi secondi.

## Accesso con la sola password
Per semplicità si entra con la sola password (senza email). È una scelta di comodità: la sicurezza dipende dalla password, quindi meglio lasciarne una lunga come quelle generate dal pannello. I tentativi sbagliati sono limitati (10 ogni quarto d’ora per connessione). Gli account sono quelli di Supabase Auth condivisi con UtilityLab: cambiare la password qui la cambia anche sugli altri siti per la stessa email.

## Errori comuni
| Messaggio | Causa | Cosa fare |
|---|---|---|
| “Accesso non ancora configurato” | manca `SUPABASE_SERVICE_ROLE_KEY` | aggiungila e fai il redeploy |
| Il link email porta a un altro sito | redirect non autorizzato | aggiungi l’URL `/auth/callback` (vedi sopra) |
| “Correzione automatica non configurata” | manca o non vale `ANTHROPIC_API_KEY` | controlla la chiave su console.anthropic.com |
| “Raggiunto il limite di N correzioni per oggi” | tetto giornaliero | alzalo in Impostazioni, oppure aspetta domani |
| Ricerca libri con pochi risultati / “un catalogo non ha risposto” | quota di Google Books senza chiave | imposta `GOOGLE_BOOKS_API_KEY` |

Lo stato delle integrazioni è in **Impostazioni → Stato delle integrazioni**.

## Backup, export e ripristino
- **Export**: Impostazioni → *Scarica JSON* (completo: libri, edizioni con provenienza delle copertine, recensioni, cronologia, impostazioni) oppure *Scarica Markdown* (leggibile). Consigliato una volta al mese, salvato su Drive.
- **Backup del database**: dipende dal piano di Supabase di UtilityLab (sul piano gratuito non c’è il ripristino a una data precisa: l’export JSON è la vera copia di sicurezza).
- **Immagini**: le copertine da Google/Open Library sono link esterni; quelle caricate a mano e le immagini hero/bio sono nei bucket `bfb-covers` e `bfb-media` (Supabase → Storage) e si scaricano da lì. Il backup del database non comprende i file.
- **Ripristino**: lo schema si ricrea con i file in `supabase/migrations/`, in ordine. I contenuti si reimportano dal JSON di export (operazione tecnica: chiedere a uno sviluppatore).

## Sicurezza (riassunto)
- RLS attiva su tutte le tabelle `bfb_`. Il pubblico legge solo `bfb_public_reviews` (righe visibili), i redirect e le impostazioni pubbliche.
- Bozze, note private, testi originali e proposte AI sono leggibili solo dagli operatori.
- Pubblicazione, ritiro e archiviazione passano da funzioni del database che verificano l’operatore e la versione.
- Verifica eseguita il 19/11/2026 simulando i tre ruoli (anonimo, autenticato estraneo, operatore) dentro una transazione annullata: nessun accesso indebito.
- Le chiavi segrete stanno solo nelle variabili d’ambiente del server.
