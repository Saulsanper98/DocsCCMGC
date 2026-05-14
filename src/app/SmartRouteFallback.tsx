import { useLocation } from 'react-router-dom';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { RouteFallback } from './RouteFallback';

function DocumentsListSkeleton() {
  return (
    <div className="app-page-x space-y-4 py-6" aria-busy aria-label="Cargando documentos">
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="app-page-x space-y-6 py-8" aria-busy aria-label="Cargando panel">
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="app-page-x space-y-4 py-8" aria-busy aria-label="Cargando administración">
      <Skeleton className="h-9 w-64" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** Esqueleto acorde a la ruta mientras `React.lazy` resuelve el chunk. */
export function SmartRouteFallback() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/documentos')) return <DocumentsListSkeleton />;
  if (pathname === '/' || pathname.startsWith('/estadisticas')) return <DashboardSkeleton />;
  if (pathname.startsWith('/admin') || pathname.startsWith('/usuarios')) return <AdminSkeleton />;
  return <RouteFallback />;
}
