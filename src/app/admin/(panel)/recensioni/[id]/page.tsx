// E:\blog-fabio\src\app\admin\(panel)\recensioni\[id]\page.tsx
import { notFound } from 'next/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { loadEditorState } from '@/server/reviews/load';
import { ReviewEditor } from '@/components/admin/editor/ReviewEditor';
import { AppError } from '@/server/http';

export default async function EditReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createUserClient();
  try {
    const state = await loadEditorState(supabase, id);
    return <ReviewEditor initial={state} />;
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }
}
