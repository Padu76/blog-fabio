// E:\blog-fabio\src\app\(public)\recensioni\page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllTags, PAGE_SIZE, searchArchive } from '@/server/public/reviews';
import { ReviewCard } from '@/components/public/ReviewCard';

export const metadata: Metadata = {
  title: 'Recensioni',
  description: 'Tutte le recensioni: cerca per titolo, autore o argomento.',
  alternates: { canonical: '/recensioni' },
};

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function ArchivePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 80);
  const tag = one(sp.tag).slice(0, 40);
  const band = ['alto', 'medio', 'basso'].includes(one(sp.voto)) ? one(sp.voto) : '';
  const sort = ['voto', 'titolo'].includes(one(sp.ordina)) ? one(sp.ordina) : 'recenti';
  const page = Math.max(1, Math.min(500, Number.parseInt(one(sp.pagina), 10) || 1));
  const [{ items, total }, tags] = await Promise.all([searchArchive({ q, tag, band, sort, page }), getAllTags()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || tag || band);

  const link = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set('q', q); if (tag) u.set('tag', tag); if (band) u.set('voto', band);
    if (sort !== 'recenti') u.set('ordina', sort); if (p > 1) u.set('pagina', String(p));
    const s = u.toString();
    return `/recensioni${s ? `?${s}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Recensioni</h1>

      <form id="cerca" method="get" action="/recensioni" role="search" className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Cerca
          <input name="q" type="search" defaultValue={q} placeholder="Titolo, autore, argomento…" className="rounded-md border border-line bg-bg px-3 py-2.5 text-base text-ink" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Tema
          <select name="tag" defaultValue={tag} className="rounded-md border border-line bg-bg px-3 py-2.5 text-base text-ink">
            <option value="">Tutti</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Voto
          <select name="voto" defaultValue={band} className="rounded-md border border-line bg-bg px-3 py-2.5 text-base text-ink">
            <option value="">Qualsiasi</option>
            <option value="alto">8 o più</option>
            <option value="medio">da 6 a 7,5</option>
            <option value="basso">sotto il 6</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Ordina
          <select name="ordina" defaultValue={sort} className="rounded-md border border-line bg-bg px-3 py-2.5 text-base text-ink">
            <option value="recenti">Più recenti</option>
            <option value="voto">Voto più alto</option>
            <option value="titolo">Titolo (A–Z)</option>
          </select>
        </label>
        <button className="rounded-md bg-accent-strong px-5 py-2.5 font-medium text-white hover:bg-ink">Cerca</button>
      </form>

      <p className="mt-6 text-sm text-muted" aria-live="polite">
        {total === 0 ? '' : `${total} ${total === 1 ? 'recensione' : 'recensioni'}`}
      </p>

      {items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center">
          <p className="font-serif text-lg italic text-muted">
            {filtered ? 'Nessuna recensione corrisponde alla ricerca.' : 'Non ci sono ancora recensioni pubblicate.'}
          </p>
          {filtered && <Link href="/recensioni" className="mt-3 inline-block text-accent-strong hover:underline">Azzera i filtri</Link>}
        </div>
      ) : (
        <div className="mt-6 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => <ReviewCard key={r.slug} r={r} />)}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagine" className="mt-10 flex items-center justify-center gap-4">
          {page > 1 ? <Link href={link(page - 1)} className="rounded-md border border-line px-4 py-2 hover:bg-surface">← Precedenti</Link> : <span />}
          <span className="text-sm text-muted">Pagina {page} di {pages}</span>
          {page < pages ? <Link href={link(page + 1)} className="rounded-md border border-line px-4 py-2 hover:bg-surface">Successive →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
