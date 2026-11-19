// E:\blog-fabio\src\app\(public)\privacy\page.tsx
import type { Metadata } from 'next';
import { getPublicSettings } from '@/server/settings';

export const revalidate = 86400;
export const metadata: Metadata = { title: 'Privacy', alternates: { canonical: '/privacy' } };

export default async function PrivacyPage() {
  const { site } = await getPublicSettings();
  return (
    <div className="prose-review mx-auto px-4 py-10 text-ink">
      <h1 className="font-sans text-4xl">Privacy</h1>
      <p className="mt-6">
        {site.name} è un blog personale di recensioni di libri. Non ci sono account per i lettori, commenti,
        newsletter né sistemi di pubblicità o profilazione.
      </p>
      <p>
        Il sito non usa cookie di tracciamento. Per mostrare le pagine il servizio di hosting registra, come di norma,
        dati tecnici delle richieste (ad esempio indirizzo IP e tipo di browser) per sicurezza e funzionamento.
      </p>
      <p>
        Le copertine dei libri possono essere caricate direttamente dai servizi Google Books e Open Library: in quel
        caso il browser contatta i loro server, che ricevono i dati tecnici della richiesta secondo le rispettive
        informative.
      </p>
      <p>
        La ricerca nel sito avviene sui contenuti pubblicati e il testo cercato non viene conservato.
      </p>
    </div>
  );
}
