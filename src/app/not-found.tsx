// E:\blog-fabio\src\app\not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-serif text-4xl text-ink">Pagina non trovata</h1>
      <p className="mt-4 font-serif text-lg italic text-muted">Forse la recensione è stata ritirata, o l’indirizzo non è corretto.</p>
      <Link href="/recensioni" className="mt-6 inline-block text-accent-strong underline">Vai alle recensioni</Link>
    </main>
  );
}
