import { Search, Moon, Sun, Bell, Plus, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/app/store';
import { CcmgcBrandLogo } from '@/shared/components/CcmgcBrandLogo';
import { Button } from './ui/Button';
import { cn } from '@/shared/utils/cn';
import { useEffect, useRef, useState } from 'react';
import { formatSearchShortcut } from '@/shared/utils/platform';

const SEARCH_HINTS = [
  'Buscar por título o resumen…',
  'Atajo: abrir búsqueda global',
  'Prueba > para solo acciones',
  'Prueba # para filtrar categorías',
] as const;

export function Header() {
  const { theme, setTheme, setCommandPaletteOpen, unreadCount, setMobileDrawerOpen } = useAppStore();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [badgePop, setBadgePop] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const bellRef = useRef<HTMLSpanElement>(null);
  const prevUnreadRef = useRef(unreadCount);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 40);
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setBadgePop(true);
      setTimeout(() => setBadgePop(false), 600);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.classList.toggle('dark', mq.matches);
    }
  }, [theme]);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = window.setInterval(() => {
      setHintIndex((i) => (i + 1) % SEARCH_HINTS.length);
    }, 5200);
    return () => window.clearInterval(t);
  }, []);

  function toggleTheme() {
    setTheme(isDark ? 'light' : 'dark');
  }

  return (
    <header
      className={cn(
        'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 border-b border-[var(--divider-faint)] bg-[var(--background)]/95 backdrop-blur-sm shrink-0 rounded-b-[length:var(--radius-shell)]',
        'transition-all duration-200',
        scrolled ? 'h-11 shadow-sm elev-1' : 'h-14',
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0 min-h-11 min-w-11"
        onClick={() => setMobileDrawerOpen(true)}
        aria-label="Abrir menú de navegación"
      >
        <Menu className="h-5 w-5" strokeWidth={2} />
      </Button>

      <div
        className={cn(
          'md:hidden flex shrink-0 items-center transition-all duration-200',
          !isDark && 'rounded-[length:var(--radius-shell)] bg-[#0c1222] px-1.5 py-1 ring-1 ring-black/20',
          scrolled && 'scale-90',
        )}
        aria-hidden
      >
        <CcmgcBrandLogo
          variant="header"
          className="max-w-[72px]"
          blendWithBackground={isDark}
        />
      </div>

      <button
        type="button"
        data-tour="header-search"
        onClick={() => setCommandPaletteOpen(true)}
        className={cn(
          'flex max-w-md flex-1 cursor-pointer items-center gap-2 rounded-[length:var(--radius-shell)] border border-[var(--border)] bg-[var(--muted)] px-3 text-sm text-[var(--muted-foreground)]',
          'shadow-sm ring-1 ring-black/[0.04] dark:ring-white/10',
          'transition-all duration-200',
          'hover:border-[var(--accent)]/60 hover:bg-[var(--background)] hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
          scrolled ? 'h-8' : 'h-9',
        )}
        aria-label="Abrir búsqueda"
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span className="flex-1 text-left transition-opacity duration-300 motion-reduce:transition-none" key={hintIndex}>
          {SEARCH_HINTS[hintIndex]}
          <span className="sr-only"> {formatSearchShortcut()} </span>
        </span>
        <kbd className="hidden sm:inline-flex h-5 px-1.5 rounded border border-[var(--border)] text-[10px] font-mono tabular-nums bg-[var(--background)] text-[var(--muted-foreground)]">
          {formatSearchShortcut()}
        </kbd>
      </button>

      <div className="mx-0.5 hidden h-7 w-px shrink-0 bg-[var(--divider-faint)] sm:block" role="presentation" aria-hidden />

      <div className="flex items-center gap-0.5 sm:gap-1 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-10 min-w-10 sm:min-h-9 sm:min-w-9"
          onClick={() => navigate('/documentos/nuevo')}
          aria-label="Nuevo documento"
          title="Nuevo documento (Ctrl+N)"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-10 min-w-10 sm:min-h-9 sm:min-w-9"
          onClick={() => navigate('/notificaciones')}
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" strokeWidth={2} />
          {unreadCount > 0 && (
            <span
              ref={bellRef}
              className={cn(
                'absolute top-1 right-1 rounded-full bg-[var(--destructive)] text-white text-[10px] font-bold flex items-center justify-center transition-transform tabular-nums',
                unreadCount > 9 ? 'h-4 w-4 text-[9px]' : 'h-3.5 w-3.5',
                badgePop && 'motion-reduce:animate-none animate-[badge-pop_0.5s_var(--ease-spring)]',
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        <div className="mx-0.5 hidden h-7 w-px shrink-0 bg-[var(--divider-faint)] sm:block" role="presentation" aria-hidden />

        <Button
          variant="ghost"
          size="icon"
          className="min-h-10 min-w-10 sm:min-h-9 sm:min-w-9 overflow-hidden"
          onClick={toggleTheme}
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          <span
            key={isDark ? 'dark' : 'light'}
            className="inline-flex motion-reduce:animate-none animate-[spinIn_250ms_var(--ease-spring)]"
          >
            {isDark ? <Sun className="h-4 w-4" strokeWidth={2} /> : <Moon className="h-4 w-4" strokeWidth={2} />}
          </span>
        </Button>
      </div>
    </header>
  );
}
