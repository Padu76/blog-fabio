// E:\blog-fabio\src\app\admin\layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Area riservata',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-bg">{children}</div>;
}
