import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ArrowLeft, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/utils/cn';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/useAuth';
import toast from 'react-hot-toast';

type ReviewRow = {
  id: string;
  status: string;
  review_request_id: string;
  review_requests: {
    id: string;
    document_id: string;
    status: string;
    documents: { id: string; title: string } | null;
  } | null;
};

function normalizeReviewRow(row: Record<string, unknown>): ReviewRow {
  let req = row.review_requests as ReviewRow['review_requests'] | ReviewRow['review_requests'][] | null | undefined;
  if (Array.isArray(req)) req = req[0] ?? null;
  if (req && req.documents && Array.isArray(req.documents)) {
    const d = (req.documents as { id: string; title: string }[])[0];
    req = { ...req, documents: d ?? null };
  }
  return {
    id: String(row.id),
    status: String(row.status),
    review_request_id: String(row.review_request_id),
    review_requests: req ?? null,
  };
}

export function ShiftPanelPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('reviewer_assignments')
      .select(
        `
        id,
        status,
        review_request_id,
        review_requests (
          id,
          document_id,
          status,
          documents ( id, title )
        )
      `,
      )
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('id', { ascending: false });

    if (error) {
      console.error(error);
      toast.error('No se pudo cargar la cola de revisiones');
      setRows([]);
    } else {
      setRows((data as Record<string, unknown>[]).map(normalizeReviewRow));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveAssignment(assignmentId: string, next: 'approved' | 'rejected') {
    setBusyId(assignmentId);
    try {
      const { error } = await supabase
        .from('reviewer_assignments')
        .update({
          status: next,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);
      if (error) throw error;
      toast.success(next === 'approved' ? 'Revisión registrada' : 'Revisión rechazada');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('No se pudo actualizar la revisión');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-page-x w-full max-w-none space-y-6 py-8">
      <Link
        to="/"
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium',
          'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Inicio
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <Clock className="h-8 w-8 text-[var(--accent)]" aria-hidden />
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Panel de turno</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Cola de revisiones asignadas a tu usuario (tablas <code className="rounded bg-[var(--muted)] px-1 text-xs">review_requests</code> /{' '}
              <code className="rounded bg-[var(--muted)] px-1 text-xs">reviewer_assignments</code>).
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <Card elevation="raised" className="overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Cargando…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-[var(--muted-foreground)]">
            No tienes revisiones pendientes. Cuando te asignen una, aparecerá aquí.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((row) => {
              const req = row.review_requests;
              const doc = req?.documents;
              const docId = doc?.id ?? req?.document_id;
              const title = doc?.title ?? 'Documento';
              return (
                <li key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-[var(--muted)] p-2">
                      <FileText className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--foreground)]">{title}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Solicitud {req?.status ?? '—'} · Asignación pendiente
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {docId && (
                      <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/documentos/${docId}/editar`)}>
                        Abrir editor
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void resolveAssignment(row.id, 'approved')}
                      className="gap-1 text-emerald-700 dark:text-emerald-400"
                    >
                      {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Aprobar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void resolveAssignment(row.id, 'rejected')}
                      className="gap-1 text-[var(--destructive)]"
                    >
                      <XCircle className="h-4 w-4" />
                      Rechazar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
