<!-- E:\blog-fabio\README.md -->
# blog-fabio

Blog di libri di Fabio. Istruzioni di sviluppo in `CLAUDE.md`, requisiti in `docs/capitolato.md`.

- Guida d’uso (telefono, dettatura): `docs/guida-fabio.md`
- Guida amministrativa (chiavi, errori, backup, export): `docs/guida-admin.md`
- Variabili d’ambiente: `.env.example`
- Schema database (prefisso `bfb_`): `supabase/migrations/`

Sviluppo: `npm install`, copia `.env.example` in `.env.local`, `npm run dev`. Build: `npx next build`.
