// E:\blog-fabio\src\app\(public)\crediti\page.tsx
import type { Metadata } from 'next';
import { getPublicSettings } from '@/server/settings';

export const revalidate = 86400;
export const metadata: Metadata = { title: 'Crediti', alternates: { canonical: '/crediti' } };

export default async function CreditsPage() {
  const { site } = await getPublicSettings();
  return (
    <div className="prose-review mx-auto px-4 py-10 text-ink">
      <h1 className="font-sans text-4xl">Crediti</h1>
      <p className="mt-6">
        Dati bibliografici e copertine provengono da{' '}
        <a className="underline" href="https://books.google.com" rel="noopener" target="_blank">Google Books</a> e da{' '}
        <a className="underline" href="https://openlibrary.org" rel="noopener" target="_blank">Open Library</a>, oppure
        sono inseriti a mano. Ogni recensione indica la fonte della propria copertina. Le copertine appartengono ai
        rispettivi editori e sono mostrate a scopo di identificazione del libro recensito.
      </p>
      {site.hero_image_credit && <p>Immagine di apertura: {site.hero_image_credit}</p>}
      <p>Caratteri tipografici: Source Serif 4 e Source Sans 3 (SIL Open Font License 1.1).</p>
      <p>Recensioni, voti e opinioni sono di Fabio.</p>
    </div>
  );
}
