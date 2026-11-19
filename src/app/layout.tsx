// E:\blog-fabio\src\app\layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { serif, sans } from './fonts';
import { getPublicSettings } from '@/server/settings';
import { publicEnv } from '@/lib/env';

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getPublicSettings();
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.description,
    applicationName: site.name,
    appleWebApp: { capable: true, title: site.name, statusBarStyle: 'default' },
    openGraph: { siteName: site.name, locale: 'it_IT', type: 'website' },
  };
}

export const viewport: Viewport = {
  themeColor: '#345A6C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${serif.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
