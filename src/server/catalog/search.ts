// E:\blog-fabio\src\server\catalog\search.ts
// Ricerca progressiva: catalogo locale → cache → fornitori (con timeout e fallback). Nessun dato inventato:
// se nessuno risponde il risultato è vuoto e si passa all'inserimento manuale.
import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkIsbn, normalizeTitle } from '@/shared/isbn';
import { AppError } from '@/server/http';
import { googleBooks } from './googleBooks';
import { openLibrary, fetchOpenLibraryEdition } from './openLibrary';
import { ALLOWED_COVER_HOSTS, type CatalogCandidate, type CatalogProvider } from './types';

const POSITIVE_TTL_MS = 24 * 3600 * 1000;
const NEGATIVE_TTL_MS = 15 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 6000;
const PROVIDERS: CatalogProvider[] = [googleBooks, openLibrary];

export type PublicCandidate = {
  candidate_token: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  year: number | null;
  language: string | null;
  isbn13: string | null;
  cover_url: string | null;
  source: 'google_books' | 'open_library';
  source_url: string | null;
  match_type: CatalogCandidate['matchType'];
};

export type LocalBook = {
  book_id: string; edition_id: string | null; title: string; authors: string[]; publisher: string | null;
  year: number | null; cover_url: string | null; reviewed: boolean;
};

function score(c: CatalogCandidate, title: string, author: string): number {
  let s = 0;
  if (c.matchType === 'isbn') s += 100;
  const nt = normalizeTitle(title);
  const ct = normalizeTitle(c.title);
  if (nt && ct === nt) s += 30;
  else if (nt && (ct.startsWith(nt) || nt.startsWith(ct))) s += 18;
  else if (nt && ct.includes(nt)) s += 10;
  if (author) {
    const na = normalizeTitle(author);
    if (c.authors.some((a) => normalizeTitle(a).includes(na) || na.includes(normalizeTitle(a)))) s += 25;
  }
  if (c.language === 'it') s += 6;
  if (c.isbn13) s += 3;
  if (c.publisher) s += 1;
  if (c.coverUrl) s += 2; // vantaggio di presentazione, non prova di identità
  return s;
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
  try { return await fn(ctrl.signal); } finally { clearTimeout(t); }
}

export async function searchCatalog(
  svc: SupabaseClient, userClient: SupabaseClient, userId: string,
  input: { q: string; author: string },
): Promise<{ local: LocalBook[]; candidates: PublicCandidate[]; partial_failure: boolean; failed_providers: string[] }> {
  const q = input.q.trim().slice(0, 200);
  const author = input.author.trim().slice(0, 120);
  const isbn = checkIsbn(q);
  if (isbn.kind === 'invalid') throw new AppError('VALIDATION_ERROR', isbn.reason);
  const isbn13 = isbn.kind === 'isbn13' ? isbn.value : isbn.kind === 'isbn10' ? isbn.isbn13 : null;
  const title = isbn13 ? '' : q;
  if (!isbn13 && title.length < 3) throw new AppError('VALIDATION_ERROR', 'Scrivi almeno 3 lettere del titolo.');

  // 1. catalogo locale
  const local: LocalBook[] = [];
  {
    let query = userClient.from('bfb_editions')
      .select('id, book_id, publisher, year, cover_url, isbn13, bfb_books!inner(id, title, authors, normalized_title)')
      .limit(5);
    if (isbn13) query = query.eq('isbn13', isbn13);
    else query = query.ilike('bfb_books.normalized_title', `%${normalizeTitle(title)}%`);
    const { data } = await query;
    const bookIds = [...new Set((data ?? []).map((e) => e.book_id))];
    const { data: rev } = bookIds.length
      ? await userClient.from('bfb_reviews').select('book_id').in('book_id', bookIds)
      : { data: [] as { book_id: string }[] };
    const reviewed = new Set((rev ?? []).map((r) => r.book_id));
    for (const e of data ?? []) {
      const b = e.bfb_books as unknown as { id: string; title: string; authors: string[] };
      local.push({
        book_id: b.id, edition_id: e.id, title: b.title, authors: b.authors, publisher: e.publisher,
        year: e.year, cover_url: e.cover_url, reviewed: reviewed.has(b.id),
      });
    }
  }

  // 2. cache + fornitori
  const all: CatalogCandidate[] = [];
  const failed: string[] = [];
  await Promise.all(PROVIDERS.map(async (p) => {
    const cacheKey = `${p.id}:${isbn13 ?? ''}:${normalizeTitle(title)}:${normalizeTitle(author)}`;
    const { data: cached } = await svc.from('bfb_catalog_cache').select('result_json, expires_at')
      .eq('cache_key', cacheKey).maybeSingle();
    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      all.push(...(cached.result_json as CatalogCandidate[]));
      return;
    }
    const res = await withTimeout((signal) => p.search({ title, author, isbn13 }, signal));
    if (res.failed) {
      failed.push(p.id);
      console.warn('catalogo', p.id, res.reason);
      return;
    }
    all.push(...res.candidates);
    await svc.from('bfb_catalog_cache').upsert({
      cache_key: cacheKey, provider: p.id, result_json: res.candidates,
      expires_at: new Date(Date.now() + (res.candidates.length ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS)).toISOString(),
    });
  }));

  // 3. ranking, dedup per ISBN, massimo 10
  const seen = new Set<string>();
  const ranked = all
    .map((c) => ({ c, s: score(c, title, author) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
    .filter((c) => {
      const k = c.isbn13 ? `isbn:${c.isbn13}` : `${c.provider}:${c.externalId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 10);

  // 4. token opachi: il browser non può alterare i dati del candidato
  const expires = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const rows = ranked.map((c) => ({ token: randomBytes(18).toString('base64url'), payload: c, created_by: userId, expires_at: expires }));
  if (rows.length) {
    const { error } = await svc.from('bfb_catalog_candidates').insert(rows);
    if (error) throw new AppError('INTERNAL', 'Ricerca non salvata, riprova.', true);
  }

  return {
    local,
    candidates: rows.map(({ token, payload: c }) => ({
      candidate_token: token, title: c.title, subtitle: c.subtitle, authors: c.authors, publisher: c.publisher,
      year: c.year, language: c.language, isbn13: c.isbn13, cover_url: c.coverUrl, source: c.provider,
      source_url: c.sourceUrl, match_type: c.matchType,
    })),
    partial_failure: failed.length > 0,
    failed_providers: failed,
  };
}

/** Verifica che la copertina esista davvero (solo domini ammessi, timeout, niente redirect verso altri host). */
export async function verifyCover(url: string | null): Promise<boolean> {
  if (!url) return false;
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || !ALLOWED_COVER_HOSTS.has(u.hostname)) return false;
  try {
    return await withTimeout(async (signal) => {
      let current = u;
      for (let i = 0; i < 4; i++) {
        const res = await fetch(current, { method: 'GET', redirect: 'manual', signal, cache: 'no-store' });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          if (!loc) return false;
          const next = new URL(loc, current);
          // Open Library rimanda ad archive.org e poi a un suo server (iaXXXX.us.archive.org)
          const onArchive = next.hostname === 'archive.org' || next.hostname.endsWith('.archive.org');
          if (next.protocol !== 'https:' || (!ALLOWED_COVER_HOSTS.has(next.hostname) && !onArchive)) return false;
          current = next;
          continue;
        }
        if (!res.ok) return false;
        const type = res.headers.get('content-type') ?? '';
        const len = Number(res.headers.get('content-length') ?? '0');
        await res.body?.cancel();
        // Google restituisce un'immagine minuscola "image not available": la scartiamo se < 1 KB
        return type.startsWith('image/') && (len === 0 || len > 1000);
      }
      return false;
    });
  } catch {
    return false;
  }
}

/** Risolve un token in un candidato completo (per Open Library legge l'edizione precisa). */
export async function resolveCandidate(svc: SupabaseClient, userId: string, token: string): Promise<CatalogCandidate> {
  const { data } = await svc.from('bfb_catalog_candidates').select('payload, created_by, expires_at')
    .eq('token', token).maybeSingle();
  if (!data || data.created_by !== userId || new Date(data.expires_at).getTime() < Date.now()) {
    throw new AppError('BOOK_NOT_FOUND', 'Risultato scaduto: ripeti la ricerca.');
  }
  const c = data.payload as CatalogCandidate;
  if (c.provider === 'open_library' && c.editionKey) {
    const full = await withTimeout((signal) => fetchOpenLibraryEdition(c.editionKey!, signal, c.authors)).catch(() => null);
    if (full) return { ...full, matchType: c.matchType };
  }
  return c;
}
