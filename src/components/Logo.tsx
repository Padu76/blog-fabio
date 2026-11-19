// E:\blog-fabio\src\components\Logo.tsx
// Icona: tre libri sullo scaffale (disegno originale, nessun testo).
export function BooksIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect x="8" y="14" width="11" height="38" rx="1.5" fill="currentColor" />
      <rect x="10.5" y="20" width="6" height="2" fill="#F8F5EE" />
      <rect x="22" y="10" width="11" height="42" rx="1.5" fill="currentColor" opacity="0.8" />
      <rect x="24.5" y="16" width="6" height="2" fill="#F8F5EE" />
      <rect x="36" y="18" width="10" height="34" rx="1.5" fill="currentColor" transform="rotate(-14 41 35)" opacity="0.65" />
      <rect x="4" y="53" width="56" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}
