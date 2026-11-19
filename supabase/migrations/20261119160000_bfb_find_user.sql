-- E:\blog-fabio\supabase\migrations\20261119160000_bfb_find_user.sql
-- Ricerca dell'id utente per email, per collegare un operatore a un account già esistente.
-- auth.users è condiviso con altri progetti e l'elenco completo via API può fallire o essere lento:
-- qui si legge una sola riga. Eseguibile SOLO dal ruolo di servizio (route admin già verificata).

create or replace function public.bfb_find_user_id(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.bfb_find_user_id(text) from public, anon, authenticated;
grant execute on function public.bfb_find_user_id(text) to service_role;
