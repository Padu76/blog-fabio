// E:\blog-fabio\src\app\(public)\recensioni\[slug]\page.tsx
// Recensione pubblicata: solo il contenuto approvato. Spoiler in una sezione chiusa, esclusa da estratto, SEO e ricerca.
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getReviewBySlug } from '@/server/public/reviews';
import { getPublicSettings } from '@/server/settings';
import { Cover } from '@/components/Cover';
import { ShareButton } from '@/components/public/ShareButton';
import { formatRating } from '@/shared/review';
import { publicEnv } from '@/lib/env';

export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });

function paragraphs(text: string) {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { review } = await getReviewBySlug(slug);
  if (!review) return { title: 'Recensione non trovata', robots: { index: false } };
  const title = `${review.title} — ${review.authors.join(', ')}`;
  return {
    title,
    description: review.excerpt.slice(0, 200),
    alternates: { canonical: `/recensioni/${review.slug}` },
    openGraph: {
      type: 'article', title, description: review.excerpt.slice(0, 200), url: `/recensioni/${review.slug}`,
      images: review.cover_url ? [{ url: review.cover_url }] : undefined,
    },
  };
}

export default async function ReviewPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [{ review, redirectTo }, { site }] = await Promise.all([getReviewBySlug(slug), getPublicSettings()]);
  if (redirectTo) permanentRedirect(`/recensioni/${redirectTo}`);
  if (!review) notFound();

  const updated = new Date(review.published_at).getTime() - new Date(review.first_published_at).getTime() > 24 * 3600 * 1000;
  const meta = [review.publisher, review.year, review.page_count ? `${review.page_count} pagine` : null, review.isbn13 ? `ISBN ${review.isbn13}` : null]
    .filter(Boolean).join(' · ');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'Book', name: review.title, author: review.authors.map((a) => ({ '@type': 'Person', name: a })),
      ...(review.isbn13 ? { isbn: review.isbn13 } : {}), ...(review.publisher ? { publisher: review.publisher } : {}),
    },
    reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 10, worstRating: 0 },
    author: { '@type': 'Person', name: 'Fabio' },
    datePublished: review.first_published_at,
    dateModified: review.published_at,
    reviewBody: review.excerpt,
    publisher: { '@type': 'Organization', name: site.name },
    url: `${publicEnv.siteUrl}/recensioni/${review.slug}`,
  };

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Cover url={review.cover_url} title={review.title} authors={review.authors} className="w-40 sm:w-48" priority />
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">{review.authors.join(', ')}</p>
          <h1 className="mt-1 font-serif text-4xl italic leading-tight text-ink sm:text-5xl">{review.title}</h1>
          {review.subtitle && <p className="mt-1 font-serif text-xl text-muted">{review.subtitle}</p>}
          {meta && <p className="mt-3 text-sm text-muted">{meta}</p>}
          <p className="mt-4 font-serif text-3xl text-accent-strong" aria-label={`Voto di Fabio: ${formatRating(review.rating)} su 10`}>
            {formatRating(review.rating)} <span className="text-xl text-muted">/ 10</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            Pubblicata il <time dateTime={review.first_published_at}>{dateFmt.format(new Date(review.first_published_at))}</time>
            {updated && <> · aggiornata il <time dateTime={review.published_at}>{dateFmt.format(new Date(review.published_at))}</time></>}
          </p>
        </div>
      </div>

      <p className="prose-review mt-10 border-l-4 border-accent pl-4 italic text-ink/90">{review.excerpt}</p>

      <div className="prose-review mt-8 text-ink">
        {paragraphs(review.body).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
      </div>

      {review.has_spoilers && review.spoiler_body && (
        <details className="mt-10 max-w-[68ch] rounded-xl border border-danger/40 bg-surface p-5">
          <summary className="cursor-pointer font-medium text-danger">
            Attenzione: questa parte contiene anticipazioni sulla trama. Apri solo se hai già letto il libro.
          </summary>
          <div className="prose-review mt-4 text-ink">
            {paragraphs(review.spoiler_body).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
          </div>
        </details>
      )}

      {review.tags.length > 0 && (
        <ul className="mt-10 flex flex-wrap gap-2" aria-label="Temi">
          {review.tags.map((t) => (
            <li key={t}><a href={`/recensioni?tag=${encodeURIComponent(t)}`} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:border-accent hover:text-accent-strong">{t}</a></li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-line pt-6 text-sm text-muted">
        <ShareButton title={review.title} />
        {review.cover_url && review.cover_attribution && (
          <span>
            Copertina: {review.cover_source_page_url
              ? <a href={review.cover_source_page_url} rel="noopener nofollow" target="_blank" className="underline hover:text-accent-strong">{review.cover_attribution}</a>
              : review.cover_attribution}
          </span>
        )}
      </div>
    </article>
  );
}
