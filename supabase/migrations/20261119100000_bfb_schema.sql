-- E:\blog-fabio\supabase\migrations\20261119100000_bfb_schema.sql
-- Blog di Fabio: schema iniziale. Prefisso bfb_ (il prefisso bf_ è già usato da un altro progetto
-- nell'istanza condivisa UtilityLab: NON toccare le tabelle bf_*).

-- ---------------------------------------------------------------------------
-- Funzioni di servizio
-- ---------------------------------------------------------------------------
create or replace function public.bfb_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Operatori (essere autenticati NON basta: serve una riga attiva qui)
-- ---------------------------------------------------------------------------
create table public.bfb_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('admin', 'editor')),
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bfb_admins_updated before update on public.bfb_admins
  for each row execute function public.bfb_set_updated_at();

create or replace function public.bfb_is_operator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bfb_admins a
    where a.user_id = (select auth.uid()) and a.active
  );
$$;

create or replace function public.bfb_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bfb_admins a
    where a.user_id = (select auth.uid()) and a.active and a.role = 'admin'
  );
$$;

revoke all on function public.bfb_is_operator() from public, anon;
revoke all on function public.bfb_is_admin() from public, anon;
grant execute on function public.bfb_is_operator() to authenticated, service_role;
grant execute on function public.bfb_is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Impostazioni (pubbliche / private). Nessun segreto qui.
-- ---------------------------------------------------------------------------
create table public.bfb_settings (
  key text primary key,
  value jsonb not null,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create trigger bfb_settings_updated before update on public.bfb_settings
  for each row execute function public.bfb_set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogo: opera ed edizione
-- ---------------------------------------------------------------------------
create table public.bfb_books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  subtitle text,
  authors text[] not null default '{}',
  normalized_title text not null default '',
  language text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bfb_books_normalized_title_idx on public.bfb_books (normalized_title);
create trigger bfb_books_updated before update on public.bfb_books
  for each row execute function public.bfb_set_updated_at();

create table public.bfb_editions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.bfb_books(id) on delete cascade,
  isbn10 text check (isbn10 is null or isbn10 ~ '^[0-9]{9}[0-9X]$'),
  isbn13 text check (isbn13 is null or isbn13 ~ '^97[89][0-9]{10}$'),
  publisher text,
  publication_date_text text,
  year int check (year is null or year between 1000 and 2100),
  language text,
  page_count int check (page_count is null or page_count > 0),
  -- provenienza della scheda
  provider text not null default 'manual' check (provider in ('google_books', 'open_library', 'manual')),
  external_id text,
  source_url text,
  fetched_at timestamptz,
  -- copertina
  cover_mode text not null default 'none' check (cover_mode in ('external', 'uploaded', 'none')),
  cover_url text,
  cover_provider text,
  cover_storage_path text,
  cover_attribution text,
  cover_source_page_url text,
  cover_width int,
  cover_height int,
  cover_checked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bfb_editions_book_idx on public.bfb_editions (book_id);
create unique index bfb_editions_provider_ext_uq on public.bfb_editions (provider, external_id)
  where external_id is not null;
create index bfb_editions_isbn13_idx on public.bfb_editions (isbn13) where isbn13 is not null;
create trigger bfb_editions_updated before update on public.bfb_editions
  for each row execute function public.bfb_set_updated_at();

-- ---------------------------------------------------------------------------
-- Recensioni: il documento contiene la revisione di lavoro; le revisioni
-- pubblicate sono snapshot immutabili in bfb_review_revisions.
-- ---------------------------------------------------------------------------
create table public.bfb_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  book_id uuid references public.bfb_books(id) on delete restrict,
  edition_id uuid references public.bfb_editions(id) on delete restrict,
  slug text unique,
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  published_revision_id uuid,
  version int not null default 1,
  -- revisione di lavoro
  body text not null default '',
  spoiler_body text not null default '',
  has_spoilers boolean not null default false,
  excerpt text not null default '',
  rating numeric(3,1) check (rating is null or (rating between 0 and 10 and rating * 2 = floor(rating * 2))),
  tags text[] not null default '{}',
  placeholder_ok boolean not null default false,
  private_notes text not null default '',
  last_publish_key text,
  first_published_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bfb_reviews_owner_updated_idx on public.bfb_reviews (owner_id, updated_at desc);
create index bfb_reviews_book_idx on public.bfb_reviews (book_id);

create or replace function public.bfb_reviews_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if (new.body, new.spoiler_body, new.has_spoilers, new.excerpt, new.rating, new.tags,
      new.book_id, new.edition_id, new.placeholder_ok, new.private_notes)
     is distinct from
     (old.body, old.spoiler_body, old.has_spoilers, old.excerpt, old.rating, old.tags,
      old.book_id, old.edition_id, old.placeholder_ok, old.private_notes) then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  new.owner_id := old.owner_id;
  return new;
end $$;
create trigger bfb_reviews_touch before update on public.bfb_reviews
  for each row execute function public.bfb_reviews_touch();

create table public.bfb_review_revisions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.bfb_reviews(id) on delete cascade,
  revision_number int not null,
  kind text not null check (kind in ('published', 'snapshot')),
  note text,
  body text not null,
  spoiler_body text not null default '',
  has_spoilers boolean not null default false,
  excerpt text not null default '',
  rating numeric(3,1),
  tags text[] not null default '{}',
  book_snapshot jsonb,
  source_version int,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (review_id, revision_number)
);

alter table public.bfb_reviews
  add constraint bfb_reviews_published_rev_fk
  foreign key (published_revision_id) references public.bfb_review_revisions(id) on delete set null;

-- Le revisioni sono immutabili
create or replace function public.bfb_revisions_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Le revisioni sono immutabili';
end $$;
create trigger bfb_revisions_no_update before update on public.bfb_review_revisions
  for each row execute function public.bfb_revisions_immutable();

-- Proiezione pubblica: SOLO campi approvati. Niente note private, niente testo pre-correzione.
create table public.bfb_public_reviews (
  review_id uuid primary key references public.bfb_reviews(id) on delete cascade,
  revision_id uuid not null references public.bfb_review_revisions(id) on delete cascade,
  slug text not null unique,
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  publisher text,
  year int,
  isbn13 text,
  language text,
  page_count int,
  cover_url text,
  cover_attribution text,
  cover_source_page_url text,
  rating numeric(3,1) not null,
  excerpt text not null,
  body text not null,
  spoiler_body text not null default '',
  has_spoilers boolean not null default false,
  tags text[] not null default '{}',
  search_text text not null default '',
  search_vector tsvector generated always as (to_tsvector('italian', search_text)) stored,
  first_published_at timestamptz not null,
  published_at timestamptz not null
);
create index bfb_public_reviews_search_idx on public.bfb_public_reviews using gin (search_vector);
create index bfb_public_reviews_published_idx on public.bfb_public_reviews (published_at desc);

create table public.bfb_slug_redirects (
  old_slug text primary key,
  review_id uuid not null references public.bfb_reviews(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Correzione AI e consumi
-- ---------------------------------------------------------------------------
create table public.bfb_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.bfb_reviews(id) on delete cascade,
  field text not null default 'body' check (field in ('body', 'spoiler_body')),
  input_version int not null,
  input_hash text not null,
  model text not null,
  prompt_version text not null,
  original_text text not null,
  proposed_text text not null,
  uncertain jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'discarded', 'stale')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index bfb_ai_suggestions_review_idx on public.bfb_ai_suggestions (review_id, created_at desc);

create table public.bfb_ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  review_id uuid references public.bfb_reviews(id) on delete set null,
  operation text not null default 'fix_text',
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  status text not null check (status in ('ok', 'error', 'timeout', 'invalid')),
  error_code text,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index bfb_ai_usage_user_created_idx on public.bfb_ai_usage (user_id, created_at desc);
create index bfb_ai_usage_created_idx on public.bfb_ai_usage (created_at desc);

-- ---------------------------------------------------------------------------
-- Audit, cache catalogo, candidati, rate limit (solo server)
-- ---------------------------------------------------------------------------
create table public.bfb_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index bfb_audit_events_created_idx on public.bfb_audit_events (created_at desc);

create table public.bfb_catalog_cache (
  cache_key text primary key,
  provider text not null,
  result_json jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.bfb_catalog_candidates (
  token text primary key,
  payload jsonb not null,
  created_by uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.bfb_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);

create or replace function public.bfb_rate_hit(p_bucket text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.bfb_rate_limits (bucket, window_start, hits) values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = public.bfb_rate_limits.hits + 1
  returning hits into v_hits;
  delete from public.bfb_rate_limits where window_start < now() - interval '2 days';
  return v_hits <= p_max;
end $$;
revoke all on function public.bfb_rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.bfb_rate_hit(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- RLS: negazione predefinita, poi aperture esplicite
-- ---------------------------------------------------------------------------
alter table public.bfb_admins enable row level security;
alter table public.bfb_settings enable row level security;
alter table public.bfb_books enable row level security;
alter table public.bfb_editions enable row level security;
alter table public.bfb_reviews enable row level security;
alter table public.bfb_review_revisions enable row level security;
alter table public.bfb_public_reviews enable row level security;
alter table public.bfb_slug_redirects enable row level security;
alter table public.bfb_ai_suggestions enable row level security;
alter table public.bfb_ai_usage enable row level security;
alter table public.bfb_audit_events enable row level security;
alter table public.bfb_catalog_cache enable row level security;
alter table public.bfb_catalog_candidates enable row level security;
alter table public.bfb_rate_limits enable row level security;

-- Togli i privilegi di default ad anon su tutto, poi riconcedi solo il necessario
revoke all on public.bfb_admins, public.bfb_settings, public.bfb_books, public.bfb_editions,
  public.bfb_reviews, public.bfb_review_revisions, public.bfb_public_reviews, public.bfb_slug_redirects,
  public.bfb_ai_suggestions, public.bfb_ai_usage, public.bfb_audit_events, public.bfb_catalog_cache,
  public.bfb_catalog_candidates, public.bfb_rate_limits from anon, authenticated;

-- Pubblico: solo proiezione pubblica, redirect e impostazioni pubbliche
grant select on public.bfb_public_reviews to anon, authenticated;
grant select on public.bfb_slug_redirects to anon, authenticated;
grant select on public.bfb_settings to anon, authenticated;

create policy bfb_public_reviews_read on public.bfb_public_reviews for select to anon, authenticated using (true);
create policy bfb_slug_redirects_read on public.bfb_slug_redirects for select to anon, authenticated using (true);
create policy bfb_settings_public_read on public.bfb_settings for select to anon, authenticated
  using (visibility = 'public' or (select public.bfb_is_operator()));

-- Operatori: impostazioni modificabili solo da ruolo admin
grant insert, update on public.bfb_settings to authenticated;
create policy bfb_settings_admin_insert on public.bfb_settings for insert to authenticated
  with check ((select public.bfb_is_admin()));
create policy bfb_settings_admin_update on public.bfb_settings for update to authenticated
  using ((select public.bfb_is_admin())) with check ((select public.bfb_is_admin()));

-- Operatori: lettura della propria riga; gestione solo lato server (service role)
grant select on public.bfb_admins to authenticated;
create policy bfb_admins_self_read on public.bfb_admins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.bfb_is_admin()));

-- Catalogo: operatori
grant select, insert, update on public.bfb_books, public.bfb_editions to authenticated;
create policy bfb_books_op on public.bfb_books for all to authenticated
  using ((select public.bfb_is_operator())) with check ((select public.bfb_is_operator()));
create policy bfb_editions_op on public.bfb_editions for all to authenticated
  using ((select public.bfb_is_operator())) with check ((select public.bfb_is_operator()));

-- Recensioni: proprietario (o admin). Stato, slug e pubblicazione SOLO via RPC.
grant select, insert, delete on public.bfb_reviews to authenticated;
grant update (book_id, edition_id, body, spoiler_body, has_spoilers, excerpt, rating, tags,
  placeholder_ok, private_notes) on public.bfb_reviews to authenticated;
create policy bfb_reviews_select on public.bfb_reviews for select to authenticated
  using ((select public.bfb_is_operator()) and (owner_id = (select auth.uid()) or (select public.bfb_is_admin())));
create policy bfb_reviews_insert on public.bfb_reviews for insert to authenticated
  with check ((select public.bfb_is_operator()) and owner_id = (select auth.uid()) and state = 'draft'
    and published_revision_id is null and slug is null);
create policy bfb_reviews_update on public.bfb_reviews for update to authenticated
  using ((select public.bfb_is_operator()) and (owner_id = (select auth.uid()) or (select public.bfb_is_admin())))
  with check ((select public.bfb_is_operator()) and (owner_id = (select auth.uid()) or (select public.bfb_is_admin())));
create policy bfb_reviews_delete on public.bfb_reviews for delete to authenticated
  using ((select public.bfb_is_operator()) and (owner_id = (select auth.uid()) or (select public.bfb_is_admin()))
    and state <> 'published');

-- Revisioni: lettura per chi vede la recensione; scrittura solo via RPC
grant select on public.bfb_review_revisions to authenticated;
create policy bfb_revisions_select on public.bfb_review_revisions for select to authenticated
  using (exists (select 1 from public.bfb_reviews r where r.id = review_id
    and (select public.bfb_is_operator()) and (r.owner_id = (select auth.uid()) or (select public.bfb_is_admin()))));

-- Proposte AI
grant select, insert on public.bfb_ai_suggestions to authenticated;
grant update (status, decided_at) on public.bfb_ai_suggestions to authenticated;
create policy bfb_ai_suggestions_rw on public.bfb_ai_suggestions for all to authenticated
  using (exists (select 1 from public.bfb_reviews r where r.id = review_id
    and (select public.bfb_is_operator()) and (r.owner_id = (select auth.uid()) or (select public.bfb_is_admin()))))
  with check (exists (select 1 from public.bfb_reviews r where r.id = review_id
    and (select public.bfb_is_operator()) and (r.owner_id = (select auth.uid()) or (select public.bfb_is_admin()))));

-- Consumi AI
grant select, insert on public.bfb_ai_usage to authenticated;
create policy bfb_ai_usage_select on public.bfb_ai_usage for select to authenticated
  using ((select public.bfb_is_operator()));
create policy bfb_ai_usage_insert on public.bfb_ai_usage for insert to authenticated
  with check ((select public.bfb_is_operator()) and user_id = (select auth.uid()));

-- Audit: lettura admin; scrittura operatori a proprio nome
grant select, insert on public.bfb_audit_events to authenticated;
create policy bfb_audit_select on public.bfb_audit_events for select to authenticated
  using ((select public.bfb_is_admin()));
create policy bfb_audit_insert on public.bfb_audit_events for insert to authenticated
  with check ((select public.bfb_is_operator()) and actor_id = (select auth.uid()));

-- bfb_catalog_cache, bfb_catalog_candidates, bfb_rate_limits: nessuna policy => solo service role.
