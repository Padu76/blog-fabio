// E:\blog-fabio\src\shared\review.ts
import { z } from 'zod';

export const ratingSchema = z.number().min(0).max(10).refine((n) => Number.isInteger(n * 2), 'Il voto va a passi di 0,5.');

export const workingFieldsSchema = z.object({
  body: z.string().max(60000),
  spoiler_body: z.string().max(30000),
  has_spoilers: z.boolean(),
  excerpt: z.string().max(600),
  rating: ratingSchema.nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  private_notes: z.string().max(5000),
});
export type WorkingFields = z.infer<typeof workingFieldsSchema>;

export const patchSchema = z.object({
  expected_version: z.number().int(),
  fields: workingFieldsSchema.partial(),
});

export type EditionInfo = {
  id: string; isbn10: string | null; isbn13: string | null; publisher: string | null; year: number | null;
  language: string | null; page_count: number | null; provider: 'google_books' | 'open_library' | 'manual';
  source_url: string | null; cover_mode: 'external' | 'uploaded' | 'none'; cover_url: string | null;
  cover_attribution: string | null;
};

export type BookInfo = { id: string; title: string; subtitle: string | null; authors: string[] };

export type RevisionInfo = {
  id: string; revision_number: number; kind: 'published' | 'snapshot'; note: string | null; created_at: string;
  body: string; spoiler_body: string; excerpt: string; rating: number | null;
};

export type SuggestionInfo = {
  id: string; field: 'body' | 'spoiler_body'; input_version: number; original_text: string; proposed_text: string;
  uncertain: { text: string; reason: string }[]; status: string; created_at: string; model: string;
};

export type EditorState = {
  id: string;
  state: 'draft' | 'published' | 'archived';
  slug: string | null;
  version: number;
  updated_at: string;
  published_at: string | null;
  first_published_at: string | null;
  placeholder_ok: boolean;
  fields: WorkingFields;
  book: BookInfo | null;
  edition: EditionInfo | null;
  /** la revisione pubblicata differisce dalla bozza di lavoro? */
  has_unpublished_changes: boolean;
  other_reviews_of_book: number;
};

export function formatRating(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–';
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}
