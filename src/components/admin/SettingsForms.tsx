// E:\blog-fabio\src\components\admin\SettingsForms.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiFailure, shrinkImage, uploadImage } from '@/lib/api';
import type { AiSettings, Features, SiteSettings } from '@/shared/settings';

type Op = { user_id: string; email: string; role: string; display_name: string | null; active: boolean };

const FEATURE_LABELS: Record<keyof Features, string> = {
  discovery: 'Consiglio in linguaggio naturale',
  blind_book: 'Libro al buio',
  journeys: 'Percorsi di lettura',
  public_audio: 'Presentazione audio pubblica',
  audio: 'Registrazione e trascrizione audio',
};

export function SettingsForms({
  site: initialSite, features, ai: initialAi, defaultDailyLimit, operators, me,
}: { site: SiteSettings; features: Features; ai: AiSettings; defaultDailyLimit: number; operators: Op[]; me: string }) {
  const router = useRouter();
  const [site, setSite] = useState(initialSite);
  const [ai, setAi] = useState(initialAi);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [newOp, setNewOp] = useState({ email: '', role: 'admin', display_name: '' });
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function newPassword(o: Op) {
    if (!window.confirm(`Creare una nuova password per ${o.email}? Quella di prima smette di funzionare.`)) return;
    setMsg(null); setIssued(null); setCopied(false);
    try {
      const r = await api<{ password: string }>('/api/admin/operators', { method: 'POST', json: { action: 'set_password', user_id: o.user_id } });
      setIssued({ email: o.email, password: r.password });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiFailure ? e.error.message : 'Errore.' });
    }
  }

  const field = 'mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink';
  const set = (k: keyof SiteSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setSite({ ...site, [k]: e.target.value });

  async function save(payload: object, ok = 'Salvato.') {
    setSaving(true); setMsg(null);
    try {
      await api('/api/admin/settings', { method: 'POST', json: payload });
      setMsg({ kind: 'ok', text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiFailure ? e.error.message : 'Errore.' });
    } finally { setSaving(false); }
  }

  async function upload(kind: 'hero' | 'bio', file: File) {
    setMsg(null);
    try {
      const blob = await shrinkImage(file, kind === 'hero' ? 1800 : 900);
      const r = await uploadImage<{ url: string }>(`/api/admin/media?kind=${kind}`, blob);
      const next = { ...site, [kind === 'hero' ? 'hero_image_url' : 'bio_photo_url']: r.url };
      setSite(next);
      await save({ site: next }, 'Immagine caricata e salvata.');
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiFailure ? e.error.message : (e as Error).message });
    }
  }

  async function operator(payload: object) {
    setMsg(null);
    try {
      await api('/api/admin/operators', { method: 'POST', json: payload });
      setMsg({ kind: 'ok', text: 'Operatori aggiornati.' });
      setNewOp({ email: '', role: 'admin', display_name: '' });
      router.refresh();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiFailure ? e.error.message : 'Errore.' });
    }
  }

  return (
    <>
      {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`sticky top-14 z-20 rounded-lg p-3 text-sm ${msg.kind === 'err' ? 'border border-danger/40 bg-surface text-danger' : 'bg-accent-soft text-ink'}`}>{msg.text}</p>}

      <section className={`space-y-3 rounded-xl border p-4 ${site.preview_mode ? 'border-accent-strong bg-accent-soft' : 'border-line bg-surface'}`}>
        <h2 className="font-semibold text-ink">Chi vede il sito</h2>
        <p className="text-ink">
          {site.preview_mode
            ? <>Il sito è <strong>in anteprima</strong>: lo vede solo chi è entrato nell’area riservata. I visitatori trovano la pagina “Lo scaffale si sta riempiendo”.</>
            : <>Il sito è <strong>pubblico</strong>: chiunque abbia l’indirizzo può leggere le recensioni pubblicate.</>}
        </p>
        <button
          type="button" disabled={saving}
          onClick={() => {
            if (site.preview_mode && !window.confirm('Rendere il sito pubblico? Da questo momento chiunque potrà leggere le recensioni pubblicate.')) return;
            const n = { ...site, preview_mode: !site.preview_mode };
            setSite(n);
            void save({ site: n }, n.preview_mode ? 'Il sito ora è in anteprima.' : 'Il sito ora è pubblico.');
          }}
          className="rounded-lg bg-accent-strong px-5 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {site.preview_mode ? 'Rendi il sito pubblico' : 'Rimetti il sito in anteprima'}
        </button>
        <p className="text-sm text-muted">Il cambio vale entro pochi secondi. In anteprima il sito non compare su Google.</p>
      </section>

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Sito</h2>
        <label className="block text-sm text-muted">Nome del sito<input value={site.name} onChange={set('name')} className={field} /></label>
        <label className="block text-sm text-muted">Descrizione (per i motori di ricerca)<input value={site.description} onChange={set('description')} className={field} /></label>
        <label className="block text-sm text-muted">Titolo grande in home<input value={site.hero_title} onChange={set('hero_title')} className={field} /></label>
        <label className="block text-sm text-muted">Sottotitolo in corsivo<input value={site.hero_subtitle} onChange={set('hero_subtitle')} className={field} /></label>
        <label className="block text-sm text-muted">Nota a piè di pagina<input value={site.footer_note} onChange={set('footer_note')} className={field} /></label>

        <div className="rounded-lg border border-line p-3">
          <p className="text-sm font-medium text-ink">Immagine di apertura (hero)</p>
          <p className="text-xs text-muted">Foto o illustrazione di cui avete il diritto d’uso, senza testi e senza copertine riconoscibili.</p>
          {site.hero_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.hero_image_url} alt="" className="mt-2 max-h-40 rounded" />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload('hero', f); }} className="text-sm" />
            {site.hero_image_url && <button type="button" onClick={() => { const n = { ...site, hero_image_url: null }; setSite(n); void save({ site: n }); }} className="text-sm text-danger underline">Rimuovi</button>}
          </div>
          <label className="mt-2 block text-sm text-muted">Fonte e licenza dell’immagine (compare nei Crediti)
            <input value={site.hero_image_credit ?? ''} onChange={(e) => setSite({ ...site, hero_image_credit: e.target.value || null })} className={field} />
          </label>
        </div>

        <div className="rounded-lg border border-line p-3">
          <label className="block text-sm text-muted">Titolo della pagina biografia<input value={site.bio_title} onChange={set('bio_title')} className={field} /></label>
          <label className="mt-2 block text-sm text-muted">Biografia (scritta o approvata da Fabio)
            <textarea value={site.bio_text} onChange={set('bio_text')} className={`${field} min-h-40 font-serif`} />
          </label>
          <p className="mt-2 text-sm font-medium text-ink">Foto della biografia</p>
          {site.bio_photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.bio_photo_url} alt="" className="mt-2 max-h-32 rounded" />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload('bio', f); }} className="text-sm" />
            {site.bio_photo_url && <button type="button" onClick={() => { const n = { ...site, bio_photo_url: null }; setSite(n); void save({ site: n }); }} className="text-sm text-danger underline">Rimuovi</button>}
          </div>
        </div>
        <button type="button" disabled={saving} onClick={() => void save({ site })} className="rounded-lg bg-accent-strong px-5 py-2.5 font-medium text-white disabled:opacity-60">Salva il sito</button>
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Correzione automatica (“Sistema il testo”)</h2>
        <label className="flex items-center gap-3 text-ink">
          <input type="checkbox" checked={ai.enabled} onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} className="h-5 w-5 accent-[#345A6C]" /> Attiva
        </label>
        <label className="block text-sm text-muted">Massimo di correzioni al giorno (vuoto = {defaultDailyLimit})
          <input inputMode="numeric" value={ai.daily_limit ?? ''} onChange={(e) => setAi({ ...ai, daily_limit: e.target.value ? Math.max(0, Math.min(500, Number(e.target.value) || 0)) : null })} className={field} />
        </label>
        <button type="button" disabled={saving} onClick={() => void save({ ai })} className="rounded-lg bg-accent-strong px-5 py-2.5 font-medium text-white disabled:opacity-60">Salva</button>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Funzioni future</h2>
        <p className="mt-1 text-sm text-muted">Non ancora sviluppate: restano spente finché Andrea non le richiede.</p>
        <ul className="mt-2 space-y-1 text-sm">
          {(Object.keys(FEATURE_LABELS) as (keyof Features)[]).map((k) => (
            <li key={k} className="flex items-center gap-2 text-muted">
              <input type="checkbox" checked={features[k]} disabled className="h-4 w-4" aria-label={FEATURE_LABELS[k]} /> {FEATURE_LABELS[k]}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-semibold text-ink">Chi può entrare nell’area riservata</h2>
        <ul className="divide-y divide-line text-sm">
          {operators.map((o) => (
            <li key={o.user_id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="text-ink">{o.display_name ? `${o.display_name} · ` : ''}{o.email}</span>
              <span className="text-xs text-muted">{o.role === 'admin' ? 'amministratore' : 'editor'}{o.active ? '' : ' · disattivato'}</span>
              {o.user_id !== me ? (
                <span className="ml-auto flex items-center gap-4">
                  <button type="button" onClick={() => void newPassword(o)} className="text-xs text-accent-strong underline">Nuova password</button>
                  <button type="button" onClick={() => void operator({ action: 'set_active', user_id: o.user_id, active: !o.active })} className="text-xs text-accent-strong underline">
                    {o.active ? 'Disattiva' : 'Riattiva'}
                  </button>
                </span>
              ) : (
                <a href="/admin/accesso" className="ml-auto text-xs text-accent-strong underline">Cambia la mia password</a>
              )}
            </li>
          ))}
        </ul>
        {issued && (
          <div role="status" className="rounded-lg border border-accent-strong bg-accent-soft p-3 text-ink">
            <p className="text-sm">Nuova password per <strong>{issued.email}</strong>. Copiala adesso: non verrà più mostrata.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                readOnly value={issued.password} aria-label="Nuova password"
                onFocus={(e) => e.currentTarget.select()} onClick={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-accent-strong bg-surface px-3 py-2.5 font-mono text-xl text-ink"
              />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(issued.password)
                    .then(() => setCopied(true))
                    .catch(() => setMsg({ kind: 'err', text: 'Copia non riuscita: seleziona la password e copiala a mano.' }));
                }}
                className="rounded-lg bg-accent-strong px-5 py-2.5 font-medium text-white"
              >
                {copied ? 'Copiata ✓' : 'Copia'}
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">Una volta entrato, può cambiarla da “Il mio accesso”.</p>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); void operator({ action: 'add', ...newOp }); }} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input required type="email" placeholder="email" value={newOp.email} onChange={(e) => setNewOp({ ...newOp, email: e.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2.5" />
          <input placeholder="nome (facoltativo)" value={newOp.display_name} onChange={(e) => setNewOp({ ...newOp, display_name: e.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2.5" />
          <select value={newOp.role} onChange={(e) => setNewOp({ ...newOp, role: e.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2.5">
            <option value="admin">amministratore</option><option value="editor">editor</option>
          </select>
          <button className="rounded-lg bg-accent-strong px-4 py-2.5 text-white">Aggiungi</button>
        </form>
        <p className="text-xs text-muted">Dopo averlo aggiunto, premi “Nuova password” e comunicagliela: entra dalla pagina di accesso con la sola password, e può cambiarla da “Il mio accesso”. La password non è leggibile da nessuno: se la dimentica gliene crei un’altra.</p>
      </section>
    </>
  );
}
