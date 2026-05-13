import { useState, Suspense } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { StickyNote } from 'lucide-react';
import { Sidebar } from '@/shared/components/Sidebar';
import { Header } from '@/shared/components/Header';
import { CommandPalette } from '@/shared/components/CommandPalette';
import { KeyboardShortcutsModal } from '@/shared/components/KeyboardShortcutsModal';
import { PageTransition } from '@/shared/components/PageTransition';
import { QuickNoteModal } from '@/shared/components/QuickNoteModal';
import { NavProgressBar } from '@/shared/components/NavProgressBar';
import { ScrollToTop } from '@/shared/components/ScrollToTop';
import { useAuth } from '@/features/auth/useAuth';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from './store';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { useRealtimeNotifications } from '@/shared/hooks/useRealtime';
import { RouteFallback } from './RouteFallback';
import { PageBreadcrumb } from '@/shared/components/PageBreadcrumb';
import { AppFooter } from '@/shared/components/AppFooter';
import { AppOnboarding } from '@/shared/components/AppOnboarding';
import { OnlineBanner } from '@/shared/components/OnlineBanner';
import { useCategories } from '@/features/categories/useCategories';

export function AppLayout() {
  const { user, loading } = useAuth();
  const { theme } = useAppStore();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.classList.toggle('dark', mq.matches);
      const handler = (e: MediaQueryListEvent) => document.documentElement.classList.toggle('dark', e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  useRealtimeNotifications();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <div className="space-y-3 w-48">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <LayoutInner showShortcuts={showShortcuts} setShowShortcuts={setShowShortcuts} />
  );
}

function LayoutInner({
  showShortcuts,
  setShowShortcuts,
}: {
  showShortcuts: boolean;
  setShowShortcuts: (v: boolean) => void;
}) {
  const { setCommandPaletteOpen, mobileDrawerOpen, setMobileDrawerOpen } = useAppStore();
  const navigate = useNavigate();
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useCategories();

  useKeyboardShortcuts([
    { key: 'k', ctrl: true, action: () => setCommandPaletteOpen(true), description: 'Búsqueda' },
    { key: 'n', ctrl: true, action: () => navigate('/documentos/nuevo'), description: 'Nuevo documento' },
    {
      key: 'n',
      ctrl: true,
      shift: true,
      action: () => setQuickNoteOpen(true),
      description: 'Nota rápida',
    },
    { key: '/', ctrl: true, action: () => setShowShortcuts(true), description: 'Atajos' },
  ]);

  return (
    <div className="flex h-screen min-h-0 overflow-x-hidden bg-[var(--background)]">
      <NavProgressBar />

      <a
        href="#main-content"
        className="skip-link"
        onClick={() => {
          requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
        }}
      >
        Saltar al contenido principal
      </a>
      {mobileDrawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-app-drawer-backdrop bg-[var(--overlay-scrim)] backdrop-blur-[2px] md:hidden cursor-default motion-reduce:backdrop-blur-none"
          aria-label="Cerrar menú"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <OnlineBanner />
        <Header />
        <main
          id="main-content"
          role="main"
          ref={mainRef}
          data-tour="main-content"
          className="app-main-surface flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth outline-none"
          tabIndex={-1}
        >
          <PageBreadcrumb />
          <div className="flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<RouteFallback />}>
              <PageTransition>
                <Outlet />
              </PageTransition>
            </Suspense>
          </div>
          <AppFooter />
        </main>
      </div>

      <button
        type="button"
        className="fixed bottom-6 right-6 z-30 hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-600)] text-white shadow-[var(--shadow-brand)] ring-1 ring-white/20 hover:opacity-95 active:scale-95 motion-reduce:transition-none transition-transform"
        aria-label="Nueva nota rápida"
        title="Nota rápida (Ctrl+Shift+N)"
        onClick={() => setQuickNoteOpen(true)}
      >
        <StickyNote className="h-5 w-5" aria-hidden />
      </button>

      <ScrollToTop scrollContainerRef={mainRef} />

      <QuickNoteModal open={quickNoteOpen} onOpenChange={setQuickNoteOpen} />

      <CommandPalette />

      <AppOnboarding />

      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}

      <Toaster
        position="top-right"
        gutter={10}
        containerClassName="!max-sm:top-auto !max-sm:bottom-4 !max-sm:right-4"
        toastOptions={{
          duration: 4200,
          style: {
            background: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            boxShadow: '0 10px 40px rgba(15, 23, 42, 0.12)',
          },
          success: {
            iconTheme: { primary: 'var(--success)', secondary: '#ffffff' },
            style: { borderLeft: '4px solid var(--success)' },
          },
          error: {
            iconTheme: { primary: 'var(--destructive)', secondary: '#ffffff' },
            style: { borderLeft: '4px solid var(--destructive)' },
          },
        }}
      />
    </div>
  );
}
