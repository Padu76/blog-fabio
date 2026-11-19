// E:\blog-fabio\src\shared\settings.ts
import { z } from 'zod';

export const siteSettingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(''),
  hero_title: z.string().trim().max(120).default(''),
  hero_subtitle: z.string().trim().max(200).default(''),
  hero_image_url: z.string().url().nullable().default(null),
  hero_image_credit: z.string().trim().max(300).nullable().default(null),
  bio_title: z.string().trim().max(80).default('Chi sono'),
  bio_text: z.string().max(8000).default(''),
  bio_photo_url: z.string().url().nullable().default(null),
  footer_note: z.string().trim().max(300).default(''),
  // sito in anteprima: lo vedono solo gli operatori entrati, i visitatori trovano la pagina di attesa
  preview_mode: z.boolean().default(false),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const featuresSchema = z.object({
  discovery: z.boolean().default(false),
  blind_book: z.boolean().default(false),
  journeys: z.boolean().default(false),
  public_audio: z.boolean().default(false),
  audio: z.boolean().default(false),
});
export type Features = z.infer<typeof featuresSchema>;

export const aiSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  daily_limit: z.number().int().min(0).max(500).nullable().default(null),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const DEFAULT_SITE: SiteSettings = {
  name: 'Lo scaffale di Fabio',
  description: 'Recensioni e consigli di lettura di Fabio.',
  hero_title: 'Ogni libro ha una storia. Trova la tua.',
  hero_subtitle: 'Letture, pensieri e consigli di Fabio, libraio per passione.',
  // illustrazione iniziale approvata da Andrea (ritaglio di docs/design/home-riferimento.png): sostituibile dal pannello
  hero_image_url: `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://blog-fabio.vercel.app').replace(/\/$/, '')}/hero-scaffale.jpg`,
  hero_image_credit: null,
  bio_title: 'Chi sono',
  bio_text: '',
  bio_photo_url: null,
  footer_note: '',
  preview_mode: false,
};

export const DEFAULT_FEATURES: Features = {
  discovery: false, blind_book: false, journeys: false, public_audio: false, audio: false,
};
