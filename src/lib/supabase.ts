import { createClient } from '@supabase/supabase-js';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function resolveSupabaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_SUPABASE_URL as string) || '';
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `${window.location.origin}/sb`;
  }
  return fromEnv || 'https://placeholder.supabase.co';
}

if (!import.meta.env.VITE_SUPABASE_URL || !supabaseAnonKey) {
  console.warn('Supabase env vars not set. Using mock mode.');
}

export const supabase = createClient(
  resolveSupabaseUrl(),
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
