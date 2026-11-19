// E:\blog-fabio\src\components\public\HeroArt.tsx
// Illustrazione astratta di libri (originale, senza testi né copertine reali). Usata finché non si carica un'immagine hero.
export function HeroArt() {
  return (
    <svg viewBox="0 0 420 300" className="ml-auto h-72 w-full max-w-md" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="win" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#FFFDFA" stopOpacity="0.22" />
          <stop offset="1" stopColor="#FFFDFA" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points="250,0 330,0 230,300 150,300" fill="url(#win)" />
      <rect x="40" y="250" width="360" height="14" rx="3" fill="#8A6A4F" opacity="0.85" />
      <g>
        <rect x="70" y="214" width="190" height="36" rx="3" fill="#345A6C" />
        <rect x="80" y="226" width="90" height="4" rx="2" fill="#DCE6EB" opacity="0.7" />
        <rect x="80" y="178" width="176" height="36" rx="3" fill="#E9DFCC" />
        <rect x="90" y="190" width="70" height="4" rx="2" fill="#59636B" opacity="0.6" />
        <rect x="86" y="146" width="160" height="32" rx="3" fill="#A33434" opacity="0.75" />
      </g>
      <g transform="rotate(-6 320 160)">
        <rect x="282" y="70" width="80" height="180" rx="4" fill="#F3EEE3" />
        <rect x="282" y="70" width="10" height="180" rx="3" fill="#D8D9D5" />
        <rect x="302" y="96" width="46" height="5" rx="2.5" fill="#7693A3" />
        <rect x="302" y="108" width="34" height="5" rx="2.5" fill="#7693A3" opacity="0.7" />
        <circle cx="325" cy="185" r="18" fill="#7693A3" opacity="0.35" />
      </g>
      <path d="M150 250 q45 -26 90 0 q45 -26 90 0 v6 h-180z" fill="#FFFDFA" opacity="0.92" />
      <path d="M240 250 v-24" stroke="#D8D9D5" strokeWidth="2" />
    </svg>
  );
}
