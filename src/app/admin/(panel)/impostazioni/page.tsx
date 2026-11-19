// E:\blog-fabio\src\app\admin\(panel)\impostazioni\page.tsx
import { redirect } from 'next/navigation';
import { requireOperatorPage } from '@/server/auth/guard';
import { createUserClient, hasServiceRole } from '@/lib/supabase/server';
import { publicEnv, serverEnv } from '@/lib/env';
import { aiSettingsSchema, DEFAULT_FEATURES, DEFAULT_SITE, featuresSchema, siteSettingsSchema } from '@/shared/settings';
import { SettingsForms } from '@/components/admin/SettingsForms';

// Prezzi pubblici Anthropic per milione di token (Claude Haiku 5.5, prompt ≤ 100K): solo per una stima nel pannello.
const PRICE_IN = 0.10;
const PRICE_OUT = 0.50;

export default async function SettingsPage() {
  const op = await requireOperatorPage();
  if (op.role !== 'admin') redirect('/admin');
  const supabase = await createUserClient();
  const env = serverEnv();

  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const [{ data: settings }, { data: operators }, { data: usage }] = await Promise.all([
    supabase.from('bfb_settings').select('key, value'),
    supabase.from('bfb_admins').select('user_id, email, role, display_name, active, created_at').order('created_at'),
    supabase.from('bfb_ai_usage').select('model, input_tokens, output_tokens, status, created_at').gte('created_at', monthStart.toISOString()),
  ]);
  const map = new Map((settings ?? []).map((s) => [s.key, s.value]));
  const site = siteSettingsSchema.parse({ ...DEFAULT_SITE, ...(map.get('site') ?? {}) });
  const features = featuresSchema.parse({ ...DEFAULT_FEATURES, ...(map.get('features') ?? {}) });
  const ai = aiSettingsSchema.parse({ ...(map.get('ai') ?? {}) });

  const u = usage ?? [];
  const tokIn = u.reduce((a, r) => a + r.input_tokens, 0);
  const tokOut = u.reduce((a, r) => a + r.output_tokens, 0);
  const today = u.filter((r) => new Date(r.created_at) >= dayStart).length;
  const costUsd = (tokIn * PRICE_IN + tokOut * PRICE_OUT) / 1_000_000;

  const integrations = [
    { name: 'Database e accesso (Supabase)', ok: Boolean(publicEnv.supabaseUrl && publicEnv.supabaseKey && hasServiceRole()), hint: 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY' },
    { name: 'Correzione testi (Claude)', ok: Boolean(env.anthropicKey), hint: `ANTHROPIC_API_KEY · modello ${env.editorialModel}` },
    { name: 'Google Books', ok: Boolean(env.googleBooksKey), hint: env.googleBooksKey ? 'GOOGLE_BOOKS_API_KEY' : 'Senza chiave funziona con limiti più bassi: consigliata GOOGLE_BOOKS_API_KEY' },
    { name: 'Open Library', ok: true, hint: 'Nessuna chiave necessaria' },
    { name: 'Indirizzo del sito', ok: !publicEnv.siteUrl.includes('localhost'), hint: `NEXT_PUBLIC_SITE_URL = ${publicEnv.siteUrl}` },
    { name: 'Trascrizione audio (futura)', ok: false, hint: 'Spenta (FEATURE_AUDIO=false): si detta con la tastiera del telefono' },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-ink">Impostazioni</h1>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Correzione automatica: consumo</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">Richieste questo mese</dt><dd className="text-2xl text-ink">{u.length}</dd></div>
          <div><dt className="text-muted">Oggi</dt><dd className="text-2xl text-ink">{today} / {ai.daily_limit ?? env.aiDailyLimit}</dd></div>
          <div><dt className="text-muted">Token (entrata / uscita)</dt><dd className="text-ink">{tokIn.toLocaleString('it-IT')} / {tokOut.toLocaleString('it-IT')}</dd></div>
          <div><dt className="text-muted">Costo stimato del mese</dt><dd className="text-2xl text-ink">${costUsd.toFixed(3)}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-muted">Stima con il listino pubblico di {env.editorialModel}; l’importo esatto è su console.anthropic.com.</p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Stato delle integrazioni</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {integrations.map((i) => (
            <li key={i.name} className="flex gap-2">
              <span aria-hidden="true" className={i.ok ? 'text-accent-strong' : 'text-danger'}>{i.ok ? '●' : '○'}</span>
              <span><span className="text-ink">{i.name}</span> <span className="text-muted">— {i.ok ? 'attivo' : 'non attivo'} · {i.hint}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <SettingsForms site={site} features={features} ai={ai} defaultDailyLimit={env.aiDailyLimit}
        operators={operators ?? []} me={op.userId} />

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Esporta i contenuti</h2>
        <p className="mt-1 text-sm text-muted">Una copia di libri, recensioni (anche bozze), cronologia e impostazioni.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a href="/api/admin/export?format=json" className="rounded-md border border-line px-4 py-2 text-ink">Scarica JSON</a>
          <a href="/api/admin/export?format=md" className="rounded-md border border-line px-4 py-2 text-ink">Scarica Markdown</a>
        </div>
      </section>
    </div>
  );
}
