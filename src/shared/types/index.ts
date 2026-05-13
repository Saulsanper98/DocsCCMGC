export type UserRole = 'admin' | 'editor' | 'viewer' | 'operator';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  department: string;
  last_active?: string;
  preferences: UserPreferences;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  sidebar_collapsed: boolean;
  notification_email: boolean;
  notification_inapp: boolean;
  dashboard_widgets: string[];
  quick_access: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon: string;
  color: string;
  order_index: number;
  is_pinned: boolean;
  document_count?: number;
  created_by?: string;
  created_at: string;
  children?: Category[];
}

export type DocumentStatus = 'draft' | 'review' | 'published' | 'archived';

export interface Document {
  id: string;
  title: string;
  content: Record<string, unknown>;
  content_text?: string;
  summary?: string;
  category_id?: string;
  status: DocumentStatus;
  author_id: string;
  tags: string[];
  view_count: number;
  /** Rellenado en listados cuando el usuario actual tiene el doc en favoritos */
  is_favorite?: boolean;
  is_template: boolean;
  template_variables?: TemplateVariable[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  published_at?: string;
  archived_at?: string;
  author?: UserProfile;
  category?: Category;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  content: Record<string, unknown>;
  content_text?: string;
  change_summary?: string;
  created_by: string;
  is_major_version: boolean;
  created_at: string;
  author?: UserProfile;
}

export interface Attachment {
  id: string;
  document_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by: string;
  version_number: number;
  is_main_file: boolean;
  created_at: string;
  uploader?: UserProfile;
  url?: string;
}

export interface Comment {
  id: string;
  document_id: string;
  parent_id?: string;
  author_id: string;
  content: string;
  anchor_text?: string;
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  author?: UserProfile;
  replies?: Comment[];
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'mention' | 'update' | 'comment' | 'review_request';
  title: string;
  body?: string;
  document_id?: string;
  is_read: boolean;
  created_at: string;
  document?: Pick<Document, 'id' | 'title'>;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  document_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  user?: UserProfile;
  document?: Pick<Document, 'id' | 'title'>;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  content: Record<string, unknown>;
  variables: TemplateVariable[];
  created_by: string;
  usage_count: number;
}

export interface TemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'user';
  required: boolean;
  options?: string[];
}

export interface SearchResult {
  type: 'document' | 'category' | 'action';
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  url?: string;
  item?: Document | Category;
}
