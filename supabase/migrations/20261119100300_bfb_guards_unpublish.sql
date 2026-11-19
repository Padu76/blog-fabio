-- E:\blog-fabio\supabase\migrations\20261119100300_bfb_guards_unpublish.sql
-- Trigger di guardia (al posto di REVOKE/GRANT per colonna) e ritiro senza cancellazioni:
-- la riga pubblica viene svuotata e resa invisibile (visible = false).

create or replace function public.bfb_reviews_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  -- Dal client (ruoli API) stato, slug e pubblicazione non si toccano: solo via RPC.
  if current_user in ('anon', 'authenticated') then
    new.owner_id := old.owner_id;
    new.state := old.state;
    new.slug := old.slug;
    new.published_revision_id := old.published_revision_id;
    new.last_publish_key := old.last_publish_key;
    new.first_published_at := old.first_published_at;
    new.published_at := old.published_at;
    new.archived_at := old.archived_at;
    new.created_at := old.created_at;
  end if;
  if (new.body, new.spoiler_body, new.has_spoilers, new.excerpt, new.rating, new.tags,
      new.book_id, new.edition_id, new.placeholder_ok, new.private_notes)
     is distinct from
     (old.body, old.spoiler_body, old.has_spoilers, old.excerpt, old.rating, old.tags,
      old.book_id, old.edition_id, old.placeholder_ok, old.private_notes) then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end $$;

create or replace function public.bfb_ai_suggestions_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'UPDATE' then
      new.id := old.id; new.review_id := old.review_id; new.field := old.field;
      new.input_version := old.input_version; new.input_hash := old.input_hash;
      new.model := old.model; new.prompt_version := old.prompt_version;
      new.original_text := old.original_text; new.proposed_text := old.proposed_text;
      new.uncertain := old.uncertain; new.created_by := old.created_by; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;
create trigger bfb_ai_suggestions_guard before update on public.bfb_ai_suggestions
  for each row execute function public.bfb_ai_suggestions_guard();

create or replace function public.bfb_reviews_insert_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.version := 1;
    new.last_publish_key := null; new.first_published_at := null;
    new.published_at := null; new.archived_at := null;
  end if;
  return new;
end $$;
create trigger bfb_reviews_insert_guard before insert on public.bfb_reviews
  for each row execute function public.bfb_reviews_insert_guard();

-- Rate limit: solo service role, senza pulizia distruttiva
create or replace function public.bfb_rate_hit(p_bucket text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception using message = 'FORBIDDEN';
  end if;
  insert into public.bfb_rate_limits (bucket, window_start, hits) values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = public.bfb_rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

-- Proiezione pubblica: visibilità esplicita
alter table public.bfb_public_reviews add column visible boolean not null default true;
alter policy bfb_public_reviews_read on public.bfb_public_reviews using (visible);

create or replace function public.bfb_public_reviews_visible()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.body <> '' then new.visible := true; end if;
  return new;
end $$;
create trigger bfb_public_reviews_visible before insert or update on public.bfb_public_reviews
  for each row execute function public.bfb_public_reviews_visible();

create or replace function public.bfb_hide_public_review(p_review_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.bfb_assert_can_edit(p_review_id);
  update public.bfb_public_reviews set visible = false, title = '-', subtitle = null, authors = '{}',
    publisher = null, year = null, isbn13 = null, language = null, page_count = null, cover_url = null,
    cover_attribution = null, cover_source_page_url = null, rating = 0, excerpt = '', body = '',
    spoiler_body = '', has_spoilers = false, tags = '{}', search_text = ''
  where review_id = p_review_id;
end $$;

create or replace function public.bfb_unpublish_review(p_review_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.bfb_reviews;
begin
  r := public.bfb_assert_can_edit(p_review_id);
  perform public.bfb_hide_public_review(r.id);
  update public.bfb_reviews set state = 'draft', published_revision_id = null, published_at = null,
    last_publish_key = null
  where id = r.id;
  insert into public.bfb_audit_events (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'review.unpublish', 'review', r.id::text, jsonb_build_object('slug', r.slug));
  return jsonb_build_object('review_id', r.id, 'state', 'draft', 'slug', r.slug);
end $$;

create or replace function public.bfb_archive_review(p_review_id uuid, p_archive boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.bfb_reviews;
begin
  r := public.bfb_assert_can_edit(p_review_id);
  if p_archive then
    perform public.bfb_hide_public_review(r.id);
    update public.bfb_reviews set state = 'archived', archived_at = now(), published_revision_id = null,
      published_at = null, last_publish_key = null
    where id = r.id;
  else
    update public.bfb_reviews set state = 'draft', archived_at = null where id = r.id;
  end if;
  insert into public.bfb_audit_events (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), case when p_archive then 'review.archive' else 'review.unarchive' end,
    'review', r.id::text, '{}'::jsonb);
  return jsonb_build_object('review_id', r.id, 'state', case when p_archive then 'archived' else 'draft' end,
    'slug', r.slug);
end $$;
