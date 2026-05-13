import { supabase } from '@/lib/supabase';

export type DocumentationHealthMetrics = {
  draftsNoCategory: number;
  activeNoSummary: number;
  staleDrafts: number;
  myPendingReviews: number;
};

export async function fetchDocumentationHealthMetrics(userId: string | undefined): Promise<DocumentationHealthMetrics> {
  const staleBefore = new Date();
  staleBefore.setDate(staleBefore.getDate() - 21);

  const [draftsNoCat, activeNoSum, staleDrafts] = await Promise.all([
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'draft').is('category_id', null),
    supabase.from('documents').select('id', { count: 'exact', head: true }).neq('status', 'archived').is('summary', null),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft')
      .lt('updated_at', staleBefore.toISOString()),
  ]);

  let myPendingReviews = 0;
  if (userId) {
    const { count, error } = await supabase
      .from('reviewer_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (!error) myPendingReviews = count ?? 0;
  }

  return {
    draftsNoCategory: draftsNoCat.count ?? 0,
    activeNoSummary: activeNoSum.count ?? 0,
    staleDrafts: staleDrafts.count ?? 0,
    myPendingReviews,
  };
}
