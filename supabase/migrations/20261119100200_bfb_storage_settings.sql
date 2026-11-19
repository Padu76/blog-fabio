-- E:\blog-fabio\supabase\migrations\20261119100200_bfb_storage_settings.sql
-- Bucket pubblici (solo immagini già validate dal server) e impostazioni iniziali modificabili dal pannello.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bfb-covers', 'bfb-covers', true, 4194304, array['image/webp', 'image/jpeg', 'image/png']),
  ('bfb-media', 'bfb-media', true, 4194304, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
-- Nessuna policy di scrittura su storage.objects per questi bucket: carica solo il server (service role)
-- dopo aver verificato operatore, tipo reale e decodifica dell'immagine.

-- Impostazioni iniziali: configurazione, non contenuti. Tutto modificabile dal pannello.
insert into public.bfb_settings (key, value, visibility) values
  ('site', jsonb_build_object(
     'name', 'Lo scaffale di Fabio',
     'description', 'Recensioni e consigli di lettura di Fabio.',
     'hero_title', 'Ogni libro ha una storia. Trova la tua.',
     'hero_subtitle', 'Letture, pensieri e consigli di Fabio.',
     'hero_image_url', null,
     'hero_image_credit', null,
     'bio_title', 'Chi sono',
     'bio_text', '',
     'bio_photo_url', null,
     'footer_note', ''
   ), 'public'),
  ('features', jsonb_build_object(
     'discovery', false, 'blind_book', false, 'journeys', false, 'public_audio', false, 'audio', false
   ), 'public'),
  ('ai', jsonb_build_object('enabled', true, 'daily_limit', null), 'private')
on conflict (key) do nothing;
