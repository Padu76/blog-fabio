// E:\blog-fabio\src\app\in-arrivo\page.tsx
// Pagina di attesa mostrata ai visitatori finché il sito è "in anteprima" (interruttore nel pannello).
import type { Metadata } from 'next';
import Link from 'next/link';
import { BooksIcon } from '@/components/Logo';
import { getPublicSettings } from '@/server/settings';

export const revalidate = 600;
export const metadata: Metadata = { title: 'In arrivo', robots: { index: false, follow: false } };

export default async function ComingSoonPage() {
  const { site } = await getPublicSettings();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-hero px-6 py-16 text-center text-[#FBF6EC]">
      <BooksIcon className="h-16 w-16" />
      <h1 className="mt-6 font-serif text-4xl leading-tight sm:text-6xl">{site.name}</h1>
      <p className="mt-5 max-w-xl font-serif text-xl italic sm:text-2xl">
        Lo scaffale si sta riempiendo. Le prime letture arrivano presto.
      </p>
      <Link href="/admin/login" className="mt-12 rounded-lg border border-[#FBF6EC]/70 px-5 py-2.5 text-base text-[#FBF6EC] hover:bg-[#FBF6EC] hover:text-ink">
        Area riservata
      </Link>
    </main>
  );
}
