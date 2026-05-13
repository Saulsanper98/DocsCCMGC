import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

export function RouteErrorPage() {
  const navigate = useNavigate();
  const err = useRouteError();

  let title = 'Algo salió mal';
  let detail = 'No se pudo cargar esta vista. Puedes volver al inicio o reintentar.';

  if (isRouteErrorResponse(err)) {
    title = err.status === 404 ? 'No encontrado' : `Error ${err.status}`;
    detail = typeof err.data === 'string' ? err.data : detail;
  } else if (err instanceof Error) {
    detail = err.message || detail;
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-card)] max-w-md w-full">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" aria-hidden />
        <h1 className="text-lg font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reintentar
          </Button>
          <Button type="button" onClick={() => navigate('/')}>
            <Home className="h-4 w-4" />
            Inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
