// E:\blog-fabio\src\server\settings.ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import {
  DEFAULT_FEATURES, DEFAULT_SITE, featuresSchema, siteSettingsSchema, type Features, type SiteSettings,
} from '@/shared/settings';

export const SETTINGS_TAG = 'bfb-settings';

export const getPublicSettings = unstable_cache(
  async (): Promise<{ site: SiteSettings; features: Features }> => {
    if (!isSupabaseConfigured()) return { site: DEFAULT_SITE, features: DEFAULT_FEATURES };
    try {
      const { data, error } = await createPublicClient()
        .from('bfb_settings')
        .select('key, value')
        .in('key', ['site', 'features']);
      if (error) throw error;
      const map = new Map((data ?? []).map((r) => [r.key, r.value]));
      const site = siteSettingsSchema.safeParse({ ...DEFAULT_SITE, ...(map.get('site') ?? {}) });
      const features = featuresSchema.safeParse({ ...DEFAULT_FEATURES, ...(map.get('features') ?? {}) });
      return {
        site: site.success ? site.data : DEFAULT_SITE,
        features: features.success ? features.data : DEFAULT_FEATURES,
      };
    } catch (e) {
      console.error('settings non disponibili', e instanceof Error ? e.message : e);
      return { site: DEFAULT_SITE, features: DEFAULT_FEATURES };
    }
  },
  ['bfb-public-settings-v3'],
  { tags: [SETTINGS_TAG], revalidate: 3600 },
);
