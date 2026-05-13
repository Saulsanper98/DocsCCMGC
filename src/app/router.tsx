import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './Layout';
import { RouteErrorPage } from './RouteErrorPage';

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const DocumentsPage = lazy(() =>
  import('@/features/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
const DocumentViewPage = lazy(() =>
  import('@/features/documents/DocumentViewPage').then((m) => ({ default: m.DocumentViewPage })),
);
const DocumentEditorPage = lazy(() =>
  import('@/features/documents/DocumentEditorPage').then((m) => ({ default: m.DocumentEditorPage })),
);
const SearchPage = lazy(() =>
  import('@/features/search/SearchPage').then((m) => ({ default: m.SearchPage })),
);
const CopilotPage = lazy(() =>
  import('@/features/copilot/CopilotPage').then((m) => ({ default: m.CopilotPage })),
);
const AnalyticsPage = lazy(() =>
  import('@/features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const AdminPage = lazy(() =>
  import('@/features/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
);
const HelpPage = lazy(() =>
  import('@/features/help/HelpPage').then((m) => ({ default: m.HelpPage })),
);
const KnowledgeMapPage = lazy(() =>
  import('@/features/knowledge-map/KnowledgeMapPage').then((m) => ({ default: m.KnowledgeMapPage })),
);
const ShiftPanelPage = lazy(() =>
  import('@/features/shift/ShiftPanelPage').then((m) => ({ default: m.ShiftPanelPage })),
);

function LoginSuspense() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <div className="h-9 w-9 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin motion-reduce:animate-none" />
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginSuspense />,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/documentos', element: <DocumentsPage /> },
      { path: '/documentos/nuevo', element: <DocumentEditorPage /> },
      { path: '/documentos/:id', element: <DocumentViewPage /> },
      { path: '/documentos/:id/editar', element: <DocumentEditorPage /> },
      { path: '/buscar', element: <SearchPage /> },
      { path: '/copilot', element: <CopilotPage /> },
      { path: '/estadisticas', element: <AnalyticsPage /> },
      { path: '/notificaciones', element: <NotificationsPage /> },
      { path: '/favoritos', element: <DocumentsPage filter="favorites" /> },
      { path: '/recientes', element: <DocumentsPage filter="recent" /> },
      { path: '/borradores', element: <DocumentsPage filter="drafts" /> },
      { path: '/archivados', element: <DocumentsPage filter="archived" /> },
      { path: '/usuarios', element: <Navigate to="/admin" replace /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '/ayuda', element: <HelpPage /> },
      { path: '/mapa', element: <KnowledgeMapPage /> },
      { path: '/turno', element: <ShiftPanelPage /> },
    ],
  },
]);
