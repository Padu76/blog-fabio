// E:\blog-fabio\src\components\public\ReviewCard.tsx
import Link from 'next/link';
import { Cover } from '@/components/Cover';
import { formatRating } from '@/shared/review';
import type { PublicCard } from '@/server/public/reviews';

export function ReviewCard({ r }: { r: PublicCard }) {
  return (
    <article className="flex gap-4">
      <Link href={`/recensioni/${r.slug}`} tabIndex={-1} aria-hidden="true">
        <Cover url={r.cover_url} title={r.title} authors={r.authors} className="w-24 sm:w-28" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{r.authors.join(', ')}</p>
        <h3 className="mt-1 font-serif text-xl italic leading-snug text-ink">
          <Link href={`/recensioni/${r.slug}`} className="hover:text-accent-strong">{r.title}</Link>
        </h3>
        <p className="mt-2 font-serif text-[0.98rem] leading-relaxed text-ink/90 line-clamp-4">{r.excerpt}</p>
        <p className="mt-3 flex items-center gap-3">
          <span className="font-serif text-xl text-accent-strong" aria-label={`Voto ${formatRating(r.rating)} su 10`}>
            {formatRating(r.rating)} / 10
          </span>
          {r.has_spoilers && (
            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">contiene sezione spoiler</span>
          )}
        </p>
      </div>
    </article>
  );
}
