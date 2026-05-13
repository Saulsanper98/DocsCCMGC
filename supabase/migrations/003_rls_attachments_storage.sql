-- Permitir adjuntos al autor del documento (p. ej. viewer que importa y sube el original).
-- Ampliar política INSERT de attachments.

DROP POLICY IF EXISTS "Editors can upload attachments" ON attachments;
DROP POLICY IF EXISTS "Authors and editors can upload attachments" ON attachments;

CREATE POLICY "Authors and editors can upload attachments" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'editor', 'operator')
    )
    OR EXISTS (
      SELECT 1
      FROM documents d
      WHERE d.id = document_id
        AND d.author_id = auth.uid()
    )
  );

-- =============================================================================
-- Storage: bucket "documents" (subidas desde la app importan aquí)
-- Si el bucket ya existe, solo añadimos políticas. Ejecutar una vez en Supabase.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "documents_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete_authenticated" ON storage.objects;

CREATE POLICY "documents_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "documents_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
