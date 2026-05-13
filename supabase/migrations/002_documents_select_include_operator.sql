-- Incluir rol "operator" en la política SELECT de documents.
-- Sin esto, un usuario operator solo ve documentos publicados o los que él mismo
-- creó (misma regla que viewer). El CCMGC necesita operadores con visibilidad
-- de documentos operativos (borradores/revisión) como admin/editor.

DROP POLICY IF EXISTS "Published docs viewable by all" ON documents;

CREATE POLICY "Published docs viewable by all" ON documents
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    OR author_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'editor', 'operator')
    )
  );
