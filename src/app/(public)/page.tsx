// E:\blog-fabio\src\app\(public)\page.tsx
import Link from 'next/link';
import { getPublicSettings } from '@/server/settings';
import { getLatestReviews } from '@/server/public/reviews';
import { ReviewCard } from '@/components/public/ReviewCard';
import { HeroArt } from '@/components/public/HeroArt';

export const revalidate = 600;

export default async function HomePage() {
  const [{ site }, latest] = await Promise.all([getPublicSettings(), getLatestReviews(6)]);
  const bioPreview = site.bio_text.trim().split(/\n\s*\n/)[0]?.slice(0, 320) ?? '';
  return (
    <>
      <section className="relative overflow-hidden bg-hero text-white" aria-labelledby="hero-title">
        <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-10 sm:py-14 md:grid-cols-[1.15fr_1fr] md:py-16">
          <div className="relative z-10">
            <h1 id="hero-title" className="font-serif text-4xl leading-[1.08] text-[#FFFDFA] [text-shadow:0_1px_2px_rgba(35,54,66,0.25)] sm:text-5xl lg:text-6xl">
              {site.hero_title || site.name}
            </h1>
            {site.hero_subtitle && (
              <p className="mt-4 font-serif text-lg italic text-[#FFFDFA] sm:text-xl">{site.hero_subtitle}</p>
            )}
            <form action="/recensioni" method="get" role="search" className="mt-7 flex max-w-xl overflow-hidden rounded-lg bg-surface shadow-sm ring-1 ring-white/40">
              <label htmlFor="hero-q" className="sr-only">Cerca un libro tra le recensioni</label>
              <input
                id="hero-q" name="q" type="search" placeholder="Di che libro hai bisogno oggi?"
                className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none"
              />
              <button type="submit" className="bg-accent-strong px-5 text-white hover:bg-ink" aria-label="Cerca">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 12h15m-6-6 6 6-6 6" />
                </svg>
              </button>
            </form>
          </div>
          <div className="hidden md:block">
            {site.hero_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.hero_image_url} alt="" className="ml-auto max-h-80 w-full rounded-md object-cover" fetchPriority="high" />
            ) : (
              <HeroArt />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-10 sm:pt-14" aria-labelledby="latest-title">
        <div className="flex items-end gap-4">
          <h2 id="latest-title" className="font-serif text-3xl text-ink sm:text-4xl">Le ultime letture</h2>
          <span className="mb-3 hidden h-px flex-1 bg-accent/60 sm:block" aria-hidden="true" />
          {latest.length > 0 && (
            <Link href="/recensioni" className="ml-auto whitespace-nowrap text-accent-strong hover:underline sm:ml-0">
              Tutte le recensioni →
            </Link>
          )}
        </div>
        {latest.length === 0 ? (
          <p className="mt-6 max-w-xl font-serif text-lg italic text-muted">
            Le prime recensioni arriveranno presto. Torna a trovarci.
          </p>
        ) : (
          <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:divide-x lg:divide-line [&>*]:lg:px-6 [&>*:first-child]:lg:pl-0">
            {latest.map((r) => <ReviewCard key={r.slug} r={r} />)}
          </div>
        )}
      </section>

      {bioPreview && (
        <section className="mx-auto mt-14 max-w-6xl px-4" aria-labelledby="bio-title">
          <div className="rounded-xl bg-accent-soft/70 px-6 py-7 sm:px-10">
            <h2 id="bio-title" className="font-serif text-2xl text-ink">{site.bio_title}</h2>
            <p className="mt-3 max-w-3xl font-serif text-lg leading-relaxed text-ink">{bioPreview}{site.bio_text.length > bioPreview.length ? '…' : ''}</p>
            <Link href="/chi-sono" className="mt-4 inline-block text-accent-strong hover:underline">Continua a leggere →</Link>
          </div>
        </section>
      )}
    </>
  );
}
