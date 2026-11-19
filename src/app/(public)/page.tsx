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
  // l'illustrazione predefinita è un file del sito: la serviamo dallo stesso dominio
  const isDefaultArt = Boolean(site.hero_image_url?.endsWith('/hero-scaffale.jpg'));
  const heroSrc = isDefaultArt ? '/hero-scaffale.jpg' : site.hero_image_url;
  // "Ogni libro ha una storia. Trova la tua." va su due righe, una per frase
  const titleLines = (site.hero_title || site.name).split(/(?<=[.!?])\s+/).filter(Boolean);
  return (
    <>
      <section className="relative isolate overflow-hidden bg-hero text-white" aria-labelledby="hero-title">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-10 sm:px-6 sm:py-14 lg:h-[27vw] lg:max-h-[520px] lg:min-h-[330px] lg:py-0">
          <div className="relative w-full">
            <h1 id="hero-title" className="font-serif text-[2.5rem] leading-[1.06] tracking-[-0.01em] text-[#FBF6EC] sm:text-5xl lg:text-[min(4.7vw,5.6rem)]">
              {titleLines.map((line, i) => (
                <span key={i} className="lg:block lg:whitespace-nowrap">{line}{i < titleLines.length - 1 ? ' ' : ''}</span>
              ))}
            </h1>
            {site.hero_subtitle && (
              <p className="mt-4 font-serif text-xl italic text-[#FBF6EC] sm:text-2xl lg:mt-[1.3vw] lg:text-[min(1.75vw,2.1rem)]">{site.hero_subtitle}</p>
            )}
            <form action="/recensioni" method="get" role="search"
              className="mt-7 flex max-w-xl overflow-hidden lg:mt-[2vw] lg:max-w-[min(39vw,46rem)] rounded-xl border-2 border-[#FBF6EC] bg-surface shadow-md">
              <label htmlFor="hero-q" className="sr-only">Cerca un libro tra le recensioni</label>
              <input
                id="hero-q" name="q" type="search" placeholder="Di che libro hai bisogno oggi?"
                className="min-w-0 flex-1 bg-transparent px-4 py-4 text-base text-ink placeholder:text-muted focus:outline-none sm:px-5 sm:text-xl"
              />
              <button type="submit" className="bg-accent-strong px-6 text-white transition-colors hover:bg-ink" aria-label="Cerca">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 12h15m-6-6 6 6-6 6" />
                </svg>
              </button>
            </form>
          </div>
          {!hasPhoto && <div className="hidden lg:ml-auto lg:block lg:w-[34%]"><HeroArt /></div>}
        </div>
        {hasPhoto && (
          <>
            {/* su telefono l'immagine sta sotto il testo; da tablet in su fa da sfondo, ancorata a destra */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroSrc!}
              alt=""
              fetchPriority="high"
              className="block h-44 w-full object-cover object-[88%_center] sm:h-64 lg:absolute lg:inset-0 lg:-z-20 lg:h-full lg:object-right"
            />
            {/* con una foto caricata dal pannello la parete carta da zucchero copre la parte sinistra, così il testo resta leggibile */}
            {!isDefaultArt && (
              <div aria-hidden="true" className="absolute inset-0 -z-10 hidden lg:block lg:bg-[linear-gradient(90deg,#597487_0%,#597487_38%,rgba(89,116,135,0)_62%)]" />
            )}
          </>
        )}
        {hasPhoto && site.hero_image_credit && (
          <p className="absolute bottom-2 right-3 text-[11px] text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">{site.hero_image_credit}</p>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 sm:pt-14" aria-labelledby="latest-title">
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

      <section className="mx-auto mt-14 max-w-7xl px-4 sm:mt-16 sm:px-6" aria-labelledby="bio-title">
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
