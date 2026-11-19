// E:\blog-fabio\src\app\(public)\page.tsx
// Home sul modello di docs/design/home-riferimento.png: hero carta da zucchero con fotografia sfumata a destra,
// "Le ultime letture" con sole recensioni vere, banner finale chiaro (biografia: il "libro al buio" è P1).
import Link from 'next/link';
import { getPublicSettings } from '@/server/settings';
import { getLatestReviews } from '@/server/public/reviews';
import { ReviewCard } from '@/components/public/ReviewCard';
import { HeroArt } from '@/components/public/HeroArt';

export const revalidate = 600;

export default async function HomePage() {
  const [{ site }, latest] = await Promise.all([getPublicSettings(), getLatestReviews(3)]);
  const hasPhoto = Boolean(site.hero_image_url);
  return (
    <>
      <section className="relative isolate overflow-hidden bg-hero text-white" aria-labelledby="hero-title">
        {hasPhoto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={site.hero_image_url!}
              alt=""
              fetchPriority="high"
              className="absolute inset-0 -z-20 h-full w-full object-cover object-center md:left-auto md:w-[62%]"
            />
            {/* sfumatura: carta da zucchero pieno a sinistra, foto visibile a destra */}
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-hero/80 md:bg-transparent md:bg-[linear-gradient(90deg,#557587_0%,#557587_40%,rgba(85,117,135,0.55)_60%,rgba(85,117,135,0.05)_100%)]" />
          </>
        )}
        <div className="mx-auto grid min-h-[360px] max-w-6xl items-center gap-6 px-4 py-12 sm:min-h-[420px] md:grid-cols-[1.75fr_1fr] md:py-20 lg:min-h-[460px]">
          <div className="relative">
            <h1 id="hero-title" className="font-serif text-[2.6rem] leading-[1.05] text-[#FFFDFA] [text-shadow:0_2px_12px_rgba(35,54,66,0.35)] sm:text-6xl lg:text-[4.3rem]">
              {site.hero_title || site.name}
            </h1>
            {site.hero_subtitle && (
              <p className="mt-5 font-serif text-xl italic text-[#FFFDFA] [text-shadow:0_1px_6px_rgba(35,54,66,0.35)] sm:text-2xl">{site.hero_subtitle}</p>
            )}
            <form action="/recensioni" method="get" role="search"
              className="mt-8 flex max-w-xl overflow-hidden rounded-xl border-2 border-[#FFFDFA]/80 bg-surface shadow-lg">
              <label htmlFor="hero-q" className="sr-only">Cerca un libro tra le recensioni</label>
              <input
                id="hero-q" name="q" type="search" placeholder="Di che libro hai bisogno oggi?"
                className="min-w-0 flex-1 bg-transparent px-5 py-4 text-lg text-ink placeholder:text-muted focus:outline-none"
              />
              <button type="submit" className="bg-accent-strong px-6 text-white transition-colors hover:bg-ink" aria-label="Cerca">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 12h15m-6-6 6 6-6 6" />
                </svg>
              </button>
            </form>
          </div>
          {!hasPhoto && <div className="hidden md:block"><HeroArt /></div>}
        </div>
        {hasPhoto && site.hero_image_credit && (
          <p className="absolute bottom-2 right-3 text-[11px] text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">{site.hero_image_credit}</p>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16" aria-labelledby="latest-title">
        <div className="flex items-center gap-6">
          <h2 id="latest-title" className="shrink-0 font-serif text-4xl text-ink sm:text-5xl">Le ultime letture</h2>
          <span className="hidden h-px flex-1 bg-accent sm:block" aria-hidden="true" />
          <Link href="/recensioni" className="ml-auto hidden shrink-0 items-center gap-2 text-lg text-accent-strong hover:underline sm:ml-0 sm:flex">
            Tutte le recensioni <span aria-hidden="true">→</span>
          </Link>
        </div>

        {latest.length === 0 ? (
          <div className="mt-10 grid items-center gap-8 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-[auto_1fr] sm:p-10">
            <EmptyShelf />
            <div>
              <p className="font-serif text-2xl italic text-ink">Lo scaffale si sta riempiendo.</p>
              <p className="mt-2 max-w-xl font-serif text-lg leading-relaxed text-muted">
                Le prime recensioni di Fabio arriveranno presto: libri letti davvero, raccontati con la sua voce.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-line [&>*]:lg:px-8 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0">
            {latest.map((r) => <ReviewCard key={r.slug} r={r} />)}
          </div>
        )}
        {latest.length > 0 && (
          <Link href="/recensioni" className="mt-8 inline-flex items-center gap-2 text-lg text-accent-strong hover:underline sm:hidden">
            Tutte le recensioni <span aria-hidden="true">→</span>
          </Link>
        )}
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-4 sm:mt-20" aria-labelledby="bio-title">
        <div className="flex flex-col gap-5 rounded-2xl bg-gradient-to-r from-[#DCE6EB] to-[#C9D8E0] px-6 py-7 shadow-sm sm:flex-row sm:items-center sm:gap-8 sm:px-12 sm:py-8">
          <h2 id="bio-title" className="font-serif text-3xl italic text-ink sm:text-4xl">Chi c’è dietro lo scaffale</h2>
          <span className="hidden h-12 w-px bg-ink/40 sm:block" aria-hidden="true" />
          <p className="font-serif text-lg text-ink sm:text-xl">Letture scelte e raccontate da Fabio.</p>
          <Link href="/chi-sono" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-strong px-6 py-3 text-lg text-white hover:bg-ink sm:ml-auto">
            Conosci Fabio <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}

function EmptyShelf() {
  return (
    <svg viewBox="0 0 200 120" className="mx-auto h-28 w-48" aria-hidden="true" focusable="false">
      <rect x="10" y="100" width="180" height="8" rx="2" fill="#8A6A4F" opacity="0.8" />
      <rect x="30" y="40" width="18" height="60" rx="2" fill="#345A6C" />
      <rect x="50" y="30" width="16" height="70" rx="2" fill="#7693A3" />
      <rect x="68" y="48" width="20" height="52" rx="2" fill="#E9DFCC" stroke="#D8D9D5" />
      <rect x="92" y="44" width="14" height="56" rx="2" fill="#A33434" opacity="0.7" transform="rotate(-12 99 72)" />
      <rect x="128" y="62" width="44" height="38" rx="3" fill="none" stroke="#7693A3" strokeDasharray="4 4" />
      <path d="M150 74v14M143 81h14" stroke="#7693A3" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
