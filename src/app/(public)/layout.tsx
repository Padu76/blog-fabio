// E:\blog-fabio\src\app\(public)\layout.tsx
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { getPublicSettings } from '@/server/settings';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { site, features } = await getPublicSettings();
  return (
    <>
      <a href="#contenuto" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:p-2">
        Vai al contenuto
      </a>
      <SiteHeader name={site.name} features={features} />
      <main id="contenuto">{children}</main>
      <SiteFooter name={site.name} note={site.footer_note} />
    </>
  );
}
