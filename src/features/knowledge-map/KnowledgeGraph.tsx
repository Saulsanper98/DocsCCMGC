import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { Button } from '@/shared/components/ui/Button';
import type { GraphLink, GraphNode } from './KnowledgeGraphCanvas';

const KnowledgeGraphCanvas = lazy(() =>
  import('./KnowledgeGraphCanvas').then((m) => ({ default: m.KnowledgeGraphCanvas })),
);

export function KnowledgeGraph() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: cats, error: e1 }, { data: docs, error: e2 }] = await Promise.all([
        supabase.from('categories').select('id,name,parent_id,color').order('order_index'),
        supabase
          .from('documents')
          .select('id,title,category_id,status')
          .neq('status', 'archived')
          .limit(400),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];
      const catIds = new Set((cats ?? []).map((c) => c.id));

      for (const c of cats ?? []) {
        nodes.push({
          id: `c:${c.id}`,
          name: c.name,
          nodeType: 'category',
          val: 6,
          color: (c.color as string) || '#6366f1',
        });
        if (c.parent_id && catIds.has(c.parent_id)) {
          links.push({ source: `c:${c.id}`, target: `c:${c.parent_id}` });
        }
      }

      for (const d of docs ?? []) {
        const label = (d.title as string)?.slice(0, 48) || 'Sin título';
        nodes.push({
          id: `d:${d.id}`,
          name: label,
          nodeType: 'document',
          val: 2,
          color: d.status === 'published' ? '#10b981' : d.status === 'review' ? '#f59e0b' : '#94a3b8',
        });
        const cid = d.category_id as string | null;
        if (cid && catIds.has(cid)) {
          links.push({ source: `d:${d.id}`, target: `c:${cid}` });
        }
      }

      setGraph({ nodes, links });
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el grafo. Revisa la conexión o los permisos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  if (loading) {
    return (
      <div className="flex h-[min(72vh,560px)] min-h-[360px] flex-col gap-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="flex-1 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[min(72vh,560px)] min-h-[360px] flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-6 text-center text-sm text-[var(--destructive)]">
        <p>{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void loadGraph()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="flex h-[min(72vh,560px)] min-h-[360px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted-foreground)]">
        No hay datos suficientes para dibujar el grafo.
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-[min(72vh,560px)] min-h-[360px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)]/20">
          <div className="flex flex-col items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Skeleton className="h-8 w-32" />
            <span>Cargando motor del grafo…</span>
          </div>
        </div>
      }
    >
      <KnowledgeGraphCanvas graph={graph} />
    </Suspense>
  );
}
