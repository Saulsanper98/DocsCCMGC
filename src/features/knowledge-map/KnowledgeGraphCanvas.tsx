import { useCallback, useMemo, useRef } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';

export type GraphNode = {
  id: string;
  name: string;
  nodeType: 'category' | 'document';
  val: number;
  color?: string;
};

export type GraphLink = { source: string; target: string };

export function KnowledgeGraphCanvas({ graph }: { graph: { nodes: GraphNode[]; links: GraphLink[] } }) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

  const paintNode = useCallback((node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as GraphNode;
    const r = Math.sqrt(n.val) * 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = n.color ?? (n.nodeType === 'category' ? '#6366f1' : '#64748b');
    ctx.fill();
    if (globalScale > 0.55) {
      ctx.font = `${10 / globalScale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#e2e8f0';
      const label = n.name.length > 28 ? `${n.name.slice(0, 26)}…` : n.name;
      ctx.fillText(label, 0, r + 2 / globalScale);
    }
  }, []);

  const legend = useMemo(
    () => (
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-[var(--border)] bg-[var(--card)]/95 px-3 py-2 text-[10px] text-[var(--muted-foreground)] shadow-sm backdrop-blur">
        <p className="font-semibold text-[var(--foreground)]">Leyenda</p>
        <p className="mt-1">Nodos grandes: categorías · pequeños: documentos</p>
        <p className="mt-0.5">Líneas: documento → categoría; subcategoría → categoría padre</p>
      </div>
    ),
    [],
  );

  return (
    <div className="relative h-[min(72vh,560px)] min-h-[360px] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--muted)]/20">
      {legend}
      <ForceGraph2D
        ref={fgRef}
        graphData={graph}
        nodeId="id"
        linkDirectionalArrowLength={0}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as GraphNode;
          const r = Math.sqrt(n.val) * 2.2 + 4;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        cooldownTicks={120}
        onEngineStop={() => fgRef.current?.zoomToFit(400, 12)}
        backgroundColor="transparent"
      />
    </div>
  );
}
