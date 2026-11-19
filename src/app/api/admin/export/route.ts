// E:\blog-fabio\src\app\api\admin\export\route.ts
// Esportazione dei contenuti di Fabio: JSON completo (libri, edizioni con provenienza copertine, recensioni,
// revisioni, impostazioni) oppure Markdown leggibile. Le immagini restano agli URL indicati.
import { requireOperator } from '@/server/auth/guard';
import { fail } from '@/server/http';
import { formatRating } from '@/shared/review';

export async function GET(req: Request) {
  try {
    const { supabase } = await requireOperator();
    const format = new URL(req.url).searchParams.get('format') === 'md' ? 'md' : 'json';
    const [books, editions, reviews, revisions, settings] = await Promise.all([
      supabase.from('bfb_books').select('*').order('created_at'),
      supabase.from('bfb_editions').select('*').order('created_at'),
      supabase.from('bfb_reviews').select('*').order('created_at'),
      supabase.from('bfb_review_revisions').select('*').order('created_at'),
      supabase.from('bfb_settings').select('key, value, visibility'),
    ]);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      const body = JSON.stringify({
        exported_at: new Date().toISOString(),
        books: books.data ?? [], editions: editions.data ?? [], reviews: reviews.data ?? [],
        revisions: revisions.data ?? [], settings: settings.data ?? [],
      }, null, 2);
      return new Response(body, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="recensioni-${stamp}.json"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const bookById = new Map((books.data ?? []).map((b) => [b.id, b]));
    const edById = new Map((editions.data ?? []).map((e) => [e.id, e]));
    const parts: string[] = [`# Esportazione recensioni (${stamp})\n`];
    for (const r of reviews.data ?? []) {
      const b = bookById.get(r.book_id);
      const e = edById.get(r.edition_id);
      parts.push(
        `---\n\n## ${b?.title ?? '(libro non scelto)'}${b?.authors?.length ? ` — ${b.authors.join(', ')}` : ''}\n`,
        `- Stato: ${r.state}${r.slug ? ` · /recensioni/${r.slug}` : ''}`,
        `- Voto: ${formatRating(r.rating === null ? null : Number(r.rating))} / 10`,
        e?.isbn13 ? `- ISBN: ${e.isbn13}` : '',
        e?.publisher ? `- Editore: ${e.publisher}${e.year ? ` (${e.year})` : ''}` : '',
        e?.cover_url ? `- Copertina: ${e.cover_url}${e.cover_attribution ? ` (fonte: ${e.cover_attribution})` : ''}` : '',
        r.tags?.length ? `- Tag: ${r.tags.join(', ')}` : '',
        `\n**Estratto:** ${r.excerpt || '—'}\n`,
        r.body,
        r.has_spoilers && r.spoiler_body ? `\n### Spoiler\n\n${r.spoiler_body}` : '',
        r.private_notes ? `\n> Note private: ${r.private_notes}` : '',
        '',
      );
    }
    return new Response(parts.filter((x) => x !== '').join('\n'), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="recensioni-${stamp}.md"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return fail(e);
  }
}
