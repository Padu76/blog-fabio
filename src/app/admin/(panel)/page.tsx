// E:\blog-fabio\src\app\admin\(panel)\page.tsx
import Link from 'next/link';
import { createUserClient } from '@/lib/supabase/server';
import { formatRating } from '@/shared/review';
import { Cover } from '@/components/Cover';

type SP = Promise<{ q?: string; stato?: string }>;

const LABEL: Record<string, string> = { draft: 'Bozza', published: 'Pubblicata', archived: 'Archiviata' };
const dt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const supabase = await createUserClient();
  const stato = ['draft', 'published', 'archived'].includes(sp.stato ?? '') ? sp.stato! : '';
  let query = supabase.from('bfb_reviews')
    .select('id, state, rating, updated_at, body, edition_id, bfb_books(title, authors), bfb_editions(cover_url)')
    .order('updated_at', { ascending: false }).limit(100);
  if (stato) query = query.eq('state', stato);
  else query = query.neq('state', 'archived');
  const { data } = await query;
  const q = (sp.q ?? '').trim().toLowerCase();
  const rows = (data ?? []).filter((r) => {
    if (!q) return true;
    const b = r.bfb_books as unknown as { title: string; authors: string[] } | null;
    return `${b?.title ?? ''} ${(b?.authors ?? []).join(' ')}`.toLowerCase().includes(q);
  });
  const { count: drafts } = await supabase.from('bfb_reviews').select('id', { count: 'exact', head: true }).eq('state', 'draft');
  const { count: published } = await supabase.from('bfb_reviews').select('id', { count: 'exact', head: true }).eq('state', 'published');

  return (
    <div>
      <Link
        href="/admin/recensioni/nuova"
        className="flex items-center justify-center gap-2 rounded-xl bg-accent-strong px-5 py-4 text-lg font-medium text-white shadow-sm hover:bg-ink"
      >
        <span aria-hidden="true" className="text-2xl leading-none">+</span> Nuova recensione
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <Link href="/admin?stato=draft" className="rounded-lg border border-line bg-surface p-3">
          <span className="block text-2xl font-semibold text-ink">{drafts ?? 0}</span><span className="text-sm text-muted">bozze</span>
        </Link>
        <Link href="/admin?stato=published" className="rounded-lg border border-line bg-surface p-3">
          <span className="block text-2xl font-semibold text-ink">{published ?? 0}</span><span className="text-sm text-muted">pubblicate</span>
        </Link>
      </div>

      <form className="mt-5 flex gap-2" method="get">
        <label htmlFor="adm-q" className="sr-only">Cerca</label>
        <input id="adm-q" name="q" defaultValue={sp.q} placeholder="Cerca per titolo o autore" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2.5" />
        <select name="stato" defaultValue={stato} aria-label="Stato" className="rounded-lg border border-line bg-surface px-2">
          <option value="">Attive</option><option value="draft">Bozze</option><option value="published">Pubblicate</option><option value="archived">Archiviate</option>
        </select>
        <button className="rounded-lg border border-line bg-surface px-3">Vai</button>
      </form>

      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.length === 0 && <li className="p-6 text-center text-muted">Nessuna recensione qui. Inizia con “Nuova recensione”.</li>}
        {rows.map((r) => {
          const b = r.bfb_books as unknown as { title: string; authors: string[] } | null;
          const e = r.bfb_editions as unknown as { cover_url: string | null } | null;
          return (
            <li key={r.id}>
              <Link href={`/admin/recensioni/${r.id}`} className="flex items-center gap-3 p-3 hover:bg-bg">
                <span className="w-1.5 self-stretch rounded" style={{ background: r.state === 'published' ? '#345A6C' : r.state === 'draft' ? '#7693A3' : '#D8D9D5' }} aria-hidden="true" />
                {b ? (
                  <Cover url={e?.cover_url ?? null} title={b.title} authors={b.authors ?? []} className="w-14 text-[0.5rem] sm:w-16" />
                ) : (
                  <span className="flex aspect-[2/3] w-14 shrink-0 items-center justify-center rounded-sm border border-dashed border-line text-xs text-muted sm:w-16" aria-hidden="true">?</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-lg italic text-ink">{b?.title ?? 'Libro non ancora scelto'}</span>
                  <span className="block truncate text-sm text-muted">
                    {b?.authors?.join(', ') || (r.body ? r.body.slice(0, 60) : '—')}
                  </span>
                  <span className="text-xs text-muted">
                    {LABEL[r.state]} · {dt.format(new Date(r.updated_at))}{r.rating !== null ? ` · ${formatRating(Number(r.rating))}/10` : ''}
                    {r.edition_id && !e?.cover_url ? ' · senza copertina' : ''}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
