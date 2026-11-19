-- E:\blog-fabio\supabase\migrations\20261119100100_bfb_publish_rpc.sql
-- Pubblicazione, ritiro, archiviazione e snapshot: operazioni atomiche lato DB.
-- Errori: message = codice stabile (es. VALIDATION_ERROR), detail = testo leggibile in italiano.

create or replace function public.bfb_slugify(p text)
returns text language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(
    translate(lower(coalesce(p, '')),
      'àáâãäåèéêëìíîïòóôõöùúûüýÿñçœæ''’',
      'aaaaaaeeeeiiiiooooouuuuyyncoa  '),
    '[^a-z0-9]+', '-', 'g'), '-'), 90);
$$;

create or replace function public.bfb_assert_can_edit(p_review_id uuid)
returns public.bfb_reviews language plpgsql security definer set search_path = '' as $$
declare
  r public.bfb_reviews;
begin
  if not public.bfb_is_operator() then
    raise exception using message = 'FORBIDDEN', detail = 'Non sei autorizzato.';
  end if;
  select * into r from public.bfb_reviews where id = p_review_id for update;
  if not found then
    raise exception using message = 'NOT_FOUND', detail = 'Recensione non trovata.';
  end if;
  if r.owner_id <> auth.uid() and not public.bfb_is_admin() then
    raise exception using message = 'FORBIDDEN', detail = 'Non sei autorizzato su questa recensione.';
  end if;
  return r;
end $$;
revoke all on function public.bfb_assert_can_edit(uuid) from public, anon, authenticated;

create or replace function public.bfb_publish_review(
  p_review_id uuid,
  p_expected_version int,
  p_confirm_placeholder boolean default false,
  p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.bfb_reviews;
  b public.bfb_books;
  e public.bfb_editions;
  v_slug text;
  v_base text;
  v_n int := 1;
  v_rev_id uuid;
  v_rev_no int;
  v_now timestamptz := now();
  v_first timestamptz;
begin
  r := public.bfb_assert_can_edit(p_review_id);

  -- Idempotenza: stessa chiave => stesso risultato, nessun secondo effetto
  if p_idempotency_key is not null and r.last_publish_key = p_idempotency_key
     and r.state = 'published' and r.published_revision_id is not null then
    return jsonb_build_object('review_id', r.id, 'published_revision_id', r.published_revision_id,
      'state', r.state, 'slug', r.slug, 'url', '/recensioni/' || r.slug, 'repeated', true);
  end if;

  if r.version <> p_expected_version then
    raise exception using message = 'REVISION_CONFLICT',
      detail = 'La bozza è stata modificata altrove: ricarica prima di pubblicare.';
  end if;

  if r.book_id is null then
    raise exception using message = 'VALIDATION_ERROR', detail = 'Scegli o inserisci il libro.';
  end if;
  select * into b from public.bfb_books where id = r.book_id;
  if r.edition_id is not null then
    select * into e from public.bfb_editions where id = r.edition_id;
  end if;
  if btrim(b.title) = '' or coalesce(array_length(b.authors, 1), 0) = 0 then
    raise exception using message = 'VALIDATION_ERROR', detail = 'Servono titolo e almeno un autore.';
  end if;
  if btrim(r.body) = '' then
    raise exception using message = 'VALIDATION_ERROR', detail = 'Il testo della recensione è vuoto.';
  end if;
  if r.rating is null then
    raise exception using message = 'VALIDATION_ERROR', detail = 'Scegli il voto.';
  end if;
  if btrim(r.excerpt) = '' then
    raise exception using message = 'VALIDATION_ERROR', detail = 'Scrivi l''estratto (senza spoiler).';
  end if;
  if r.has_spoilers and btrim(r.spoiler_body) = '' then
    raise exception using message = 'VALIDATION_ERROR',
      detail = 'Hai indicato spoiler ma la sezione spoiler è vuota: scrivila o togli l''opzione.';
  end if;
  if (e.id is null or e.cover_url is null) and not (p_confirm_placeholder or r.placeholder_ok) then
    raise exception using message = 'COVER_UNAVAILABLE',
      detail = 'Manca la copertina: conferma la pubblicazione con il segnaposto o caricane una.';
  end if;

  -- Slug stabile: generato alla prima pubblicazione, poi non cambia
  v_slug := r.slug;
  if v_slug is null then
    v_base := public.bfb_slugify(b.title || ' ' || coalesce(b.authors[1], ''));
    if v_base = '' then v_base := 'recensione'; end if;
    v_slug := v_base;
    while exists (select 1 from public.bfb_reviews where slug = v_slug and id <> r.id)
       or exists (select 1 from public.bfb_slug_redirects where old_slug = v_slug and review_id <> r.id) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_rev_no
    from public.bfb_review_revisions where review_id = r.id;

  insert into public.bfb_review_revisions (review_id, revision_number, kind, body, spoiler_body,
    has_spoilers, excerpt, rating, tags, book_snapshot, source_version, created_by)
  values (r.id, v_rev_no, 'published', r.body, case when r.has_spoilers then r.spoiler_body else '' end,
    r.has_spoilers, r.excerpt, r.rating, r.tags,
    jsonb_build_object('title', b.title, 'subtitle', b.subtitle, 'authors', b.authors,
      'publisher', e.publisher, 'year', e.year, 'isbn13', e.isbn13, 'isbn10', e.isbn10,
      'language', coalesce(e.language, b.language), 'page_count', e.page_count,
      'cover_url', e.cover_url, 'cover_mode', e.cover_mode, 'cover_attribution', e.cover_attribution,
      'cover_source_page_url', e.cover_source_page_url, 'provider', e.provider, 'source_url', e.source_url),
    r.version, auth.uid())
  returning id into v_rev_id;

  v_first := coalesce(r.first_published_at, v_now);

  insert into public.bfb_public_reviews (review_id, revision_id, slug, title, subtitle, authors, publisher,
    year, isbn13, language, page_count, cover_url, cover_attribution, cover_source_page_url, rating,
    excerpt, body, spoiler_body, has_spoilers, tags, search_text, first_published_at, published_at)
  values (r.id, v_rev_id, v_slug, b.title, b.subtitle, b.authors, e.publisher, e.year, e.isbn13,
    coalesce(e.language, b.language), e.page_count, e.cover_url, e.cover_attribution, e.cover_source_page_url,
    r.rating, r.excerpt, r.body, case when r.has_spoilers then r.spoiler_body else '' end, r.has_spoilers, r.tags,
    concat_ws(' ', b.title, b.subtitle, array_to_string(b.authors, ' '), e.publisher,
      array_to_string(r.tags, ' '), r.excerpt, r.body),
    v_first, v_now)
  on conflict (review_id) do update set
    revision_id = excluded.revision_id, slug = excluded.slug, title = excluded.title,
    subtitle = excluded.subtitle, authors = excluded.authors, publisher = excluded.publisher,
    year = excluded.year, isbn13 = excluded.isbn13, language = excluded.language,
    page_count = excluded.page_count, cover_url = excluded.cover_url,
    cover_attribution = excluded.cover_attribution, cover_source_page_url = excluded.cover_source_page_url,
    rating = excluded.rating, excerpt = excluded.excerpt, body = excluded.body,
    spoiler_body = excluded.spoiler_body, has_spoilers = excluded.has_spoilers, tags = excluded.tags,
    search_text = excluded.search_text, published_at = excluded.published_at;

  update public.bfb_reviews set
    state = 'published', published_revision_id = v_rev_id, slug = v_slug,
    published_at = v_now, first_published_at = v_first, archived_at = null,
    last_publish_key = p_idempotency_key,
    placeholder_ok = (placeholder_ok or p_confirm_placeholder)
  where id = r.id;

  insert into public.bfb_audit_events (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), case when r.published_revision_id is null then 'review.publish' else 'review.publish_update' end,
    'review', r.id::text, jsonb_build_object('revision', v_rev_no, 'slug', v_slug, 'version', r.version));

  return jsonb_build_object('review_id', r.id, 'published_revision_id', v_rev_id, 'state', 'published',
    'slug', v_slug, 'url', '/recensioni/' || v_slug, 'revision_number', v_rev_no, 'repeated', false);
end $$;

create or replace function public.bfb_unpublish_review(p_review_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.bfb_reviews;
begin
  r := public.bfb_assert_can_edit(p_review_id);
  delete from public.bfb_public_reviews where review_id = r.id;
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
    delete from public.bfb_public_reviews where review_id = r.id;
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

-- Snapshot della revisione di lavoro (es. testo dettato prima di accettare la correzione AI)
create or replace function public.bfb_snapshot_review(p_review_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.bfb_reviews;
  v_no int;
  v_id uuid;
begin
  r := public.bfb_assert_can_edit(p_review_id);
  select coalesce(max(revision_number), 0) + 1 into v_no from public.bfb_review_revisions where review_id = r.id;
  insert into public.bfb_review_revisions (review_id, revision_number, kind, note, body, spoiler_body,
    has_spoilers, excerpt, rating, tags, source_version, created_by)
  values (r.id, v_no, 'snapshot', left(p_note, 200), r.body, r.spoiler_body, r.has_spoilers, r.excerpt,
    r.rating, r.tags, r.version, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.bfb_publish_review(uuid, int, boolean, text) from public, anon;
revoke all on function public.bfb_unpublish_review(uuid) from public, anon;
revoke all on function public.bfb_archive_review(uuid, boolean) from public, anon;
revoke all on function public.bfb_snapshot_review(uuid, text) from public, anon;
grant execute on function public.bfb_publish_review(uuid, int, boolean, text) to authenticated;
grant execute on function public.bfb_unpublish_review(uuid) to authenticated;
grant execute on function public.bfb_archive_review(uuid, boolean) to authenticated;
grant execute on function public.bfb_snapshot_review(uuid, text) to authenticated;
