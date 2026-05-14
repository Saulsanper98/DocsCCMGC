import { useState, Suspense, useEffect, useRef } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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
import toast from 'react-hot-toast';
import { useAppStore } from './store';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { useRealtimeNotifications } from '@/shared/hooks/useRealtime';
import { SmartRouteFallback } from './SmartRouteFallback';
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
  const {
    setCommandPaletteOpen,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    visualComfort,
    breakReminderMinutes,
    quickNoteModalOpen,
    setQuickNoteModalOpen,
  } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  /** Evita scrim a pantalla completa si el estado del modal quedó incoherente al navegar. */
  useEffect(() => {
    setQuickNoteModalOpen(false);
    setCommandPaletteOpen(false);
  }, [location.pathname, setQuickNoteModalOpen, setCommandPaletteOpen]);

  useCategories();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('docbrain-comfort-default', 'docbrain-comfort-high-contrast', 'docbrain-comfort-low-luminance');
    root.classList.add(`docbrain-comfort-${visualComfort}`);
    return () => root.classList.remove(`docbrain-comfort-${visualComfort}`);
  }, [visualComfort]);

  useEffect(() => {
    if (!breakReminderMinutes) return undefined;
    const ms = breakReminderMinutes * 60 * 1000;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        toast('Tómate una pausa breve: estira piernas y descansa la vista.', { duration: 8000 });
      }
    }, ms);
    return () => window.clearInterval(id);
  }, [breakReminderMinutes]);

  useKeyboardShortcuts([
    { key: 'k', ctrl: true, action: () => setCommandPaletteOpen(true), description: 'Búsqueda' },
    { key: 'n', ctrl: true, action: () => navigate('/documentos/nuevo'), description: 'Nuevo documento' },
    {
      key: 'n',
      ctrl: true,
      shift: true,
      action: () => setQuickNoteModalOpen(true),
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
            <Suspense fallback={<SmartRouteFallback />}>
              <PageTransition>
                <div className="app-main-inner flex min-h-0 min-w-0 flex-1 flex-col">
                  <Outlet />
                </div>
              </PageTransition>
            </Suspense>
          </div>
          <AppFooter />
        </main>
      </div>

      <ScrollToTop scrollContainerRef={mainRef} />

      <QuickNoteModal open={quickNoteModalOpen} onOpenChange={setQuickNoteModalOpen} />

      <CommandPalette />

      <AppOnboarding />

      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}

      <Toaster
        position="top-right"
        gutter={10}
        containerClassName="!max-sm:top-auto !max-sm:bottom-4 !max-sm:right-4 !pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        toastOptions={{
          duration: 4200,
          style: {
            background: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            boxShadow: '0 10px 40px rgba(15, 23, 42, 0.12)',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          },
          success: {
            iconTheme: { primary: 'var(--success)', secondary: '#ffffff' },
            style: { borderLeft: '4px solid var(--success)' },
            duration: 3200,
          },
          error: {
            iconTheme: { primary: 'var(--destructive)', secondary: '#ffffff' },
            style: { borderLeft: '4px solid var(--destructive)' },
            duration: 14_000,
          },
          loading: {
            duration: 60_000,
          },
        }}
      />
    </div>
  );
}
