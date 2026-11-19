// E:\blog-fabio\src\app\(public)\chi-sono\page.tsx
import type { Metadata } from 'next';
import { getPublicSettings } from '@/server/settings';

export const revalidate = 3600;
export const metadata: Metadata = { title: 'Chi sono', alternates: { canonical: '/chi-sono' } };

export default async function BioPage() {
  const { site } = await getPublicSettings();
  const paras = site.bio_text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">{site.bio_title || 'Chi sono'}</h1>
      <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-start">
        {site.bio_photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={site.bio_photo_url} alt="Fabio" className="w-48 rounded-lg object-cover shadow-sm" />
        )}
        {paras.length ? (
          <div className="prose-review text-ink">{paras.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
        ) : (
          <p className="font-serif text-lg italic text-muted">La presentazione arriverà presto.</p>
        )}
      </div>
    </div>
  );
}
