// E:\blog-fabio\src\app\fonts.ts
// Font self-hosted (Source Serif 4 e Source Sans 3, licenza SIL OFL 1.1), serviti dal sito stesso.
import localFont from 'next/font/local';

export const serif = localFont({
  src: [
    { path: '../fonts/source-serif-4-latin-wght-normal.woff2', style: 'normal', weight: '200 900' },
    { path: '../fonts/source-serif-4-latin-wght-italic.woff2', style: 'italic', weight: '200 900' },
  ],
  variable: '--font-serif-face',
  display: 'swap',
});

export const sans = localFont({
  src: [{ path: '../fonts/source-sans-3-latin-wght-normal.woff2', style: 'normal', weight: '200 900' }],
  variable: '--font-sans-face',
  display: 'swap',
});
