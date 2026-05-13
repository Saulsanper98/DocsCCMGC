-- DocBrain CCMGC — Schema inicial
-- Ejecutar en el editor SQL de Supabase

-- ============================================================
-- PROFILES (extiende auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer', 'operator')),
  department TEXT,
  preferences JSONB DEFAULT '{"theme":"system","sidebar_collapsed":false,"notification_email":true,"notification_inapp":true,"dashboard_widgets":[],"quick_access":[]}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para crear perfil al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#3B82F6',
  order_index INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías predefinidas CCMGC
INSERT INTO categories (name, slug, icon, color, order_index, is_pinned) VALUES
  ('Procedimientos Operativos', 'procedimientos-operativos', 'clipboard-list', '#3B82F6', 1, true),
  ('Protocolos de Incidencias', 'protocolos-incidencias', 'alert-triangle', '#EF4444', 2, true),
  ('Gestión de Infraestructuras', 'gestion-infraestructuras', 'landmark', '#8B5CF6', 3, false),
  ('Sistemas y Tecnología', 'sistemas-tecnologia', 'monitor', '#06B6D4', 4, false),
  ('Informes y Estadísticas', 'informes-estadisticas', 'bar-chart', '#10B981', 5, false),
  ('Recursos Humanos', 'recursos-humanos', 'users', '#F59E0B', 6, false),
  ('Normativa y Legislación', 'normativa-legislacion', 'scale', '#6366F1', 7, false),
  ('Mantenimiento', 'mantenimiento', 'wrench', '#84CC16', 8, false),
  ('Formularios y Plantillas', 'formularios-plantillas', 'form-input', '#EC4899', 9, false),
  ('Plan de Emergencias', 'plan-emergencias', 'siren', '#F97316', 10, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  content_text TEXT,
  summary TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  author_id UUID REFERENCES profiles(id) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  view_count INTEGER DEFAULT 0,
  is_template BOOLEAN DEFAULT FALSE,
  template_variables JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

-- Full text search index
CREATE INDEX IF NOT EXISTS documents_content_text_idx ON documents USING GIN (to_tsvector('spanish', COALESCE(title, '') || ' ' || COALESCE(content_text, '')));
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status);
CREATE INDEX IF NOT EXISTS documents_author_idx ON documents(author_id);
CREATE INDEX IF NOT EXISTS documents_category_idx ON documents(category_id);

-- Función para incrementar vistas
CREATE OR REPLACE FUNCTION increment_view_count(doc_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE documents SET view_count = view_count + 1 WHERE id = doc_id;
END;
$$;

-- ============================================================
-- DOCUMENT VERSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  content_text TEXT,
  change_summary TEXT,
  created_by UUID REFERENCES profiles(id),
  is_major_version BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, version_number)
);

-- ============================================================
-- ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  version_number INTEGER DEFAULT 1,
  is_main_file BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  anchor_text TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FAVORITES
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, document_id)
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, document_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'update', 'comment', 'review_request')),
  title TEXT NOT NULL,
  body TEXT,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, is_read);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log(created_at DESC);

-- ============================================================
-- AI INTERACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action_type TEXT NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by all authenticated users" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published docs viewable by all" ON documents FOR SELECT TO authenticated
  USING (status = 'published' OR author_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor', 'operator')));
CREATE POLICY "Authors and editors can insert" ON documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "Authors and editors can update" ON documents FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "Admins can delete" ON documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by all authenticated" ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert comments" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their comments" ON comments FOR UPDATE TO authenticated USING (auth.uid() = author_id);

-- Attachments
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attachments viewable by authenticated" ON attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authors and editors can upload attachments" ON attachments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor', 'operator'))
    OR EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.author_id = auth.uid())
  );

-- Favorites
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own favorites" ON favorites FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own notifications" ON notifications FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Activity log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can view activity" ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert activity" ON activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- Categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories viewable by all authenticated" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and editors can manage categories" ON categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));

-- Supabase Storage bucket
-- Ejecutar desde el dashboard de Supabase Storage:
-- Crear bucket 'documents' con acceso autenticado
