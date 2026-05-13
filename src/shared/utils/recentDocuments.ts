/** IDs de documentos abiertos recientemente (paleta, navegación). */

const STORAGE_KEY = 'docbrain-recent-docs';
const MAX = 12;

export type RecentDocumentEntry = { id: string; title: string; at: number };

export function getRecentDocuments(): RecentDocumentEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentDocumentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentDocument(id: string, title: string): void {
  if (typeof localStorage === 'undefined' || !id) return;
  const prev = getRecentDocuments().filter((e) => e.id !== id);
  const next: RecentDocumentEntry[] = [{ id, title: title || 'Sin título', at: Date.now() }, ...prev].slice(0, MAX);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}
