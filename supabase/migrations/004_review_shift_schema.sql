-- DocBrain V2 — Revisión/aprobación y panel de turno (esquema base; RLS ampliable)

CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_version INTEGER NOT NULL,
  requested_by UUID REFERENCES profiles(id),
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'approved', 'rejected')),
  require_all_approvals BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviewer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id UUID NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  comment TEXT,
  reviewed_at TIMESTAMPTZ,
  UNIQUE (review_request_id, user_id)
);

CREATE TABLE IF NOT EXISTS shift_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES profiles(id),
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  handover_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_record_id UUID NOT NULL REFERENCES shift_records(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'info' CHECK (entry_type IN ('info', 'incident', 'system', 'communication')),
  author_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_requests_document ON review_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_assignments_request ON reviewer_assignments(review_request_id);
CREATE INDEX IF NOT EXISTS idx_shift_log_shift ON shift_log_entries(shift_record_id);

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_log_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "review_requests_authenticated" ON review_requests;
CREATE POLICY "review_requests_authenticated" ON review_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reviewer_assignments_authenticated" ON reviewer_assignments;
CREATE POLICY "reviewer_assignments_authenticated" ON reviewer_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shift_records_authenticated" ON shift_records;
CREATE POLICY "shift_records_authenticated" ON shift_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shift_log_entries_authenticated" ON shift_log_entries;
CREATE POLICY "shift_log_entries_authenticated" ON shift_log_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
