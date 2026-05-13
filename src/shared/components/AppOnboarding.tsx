import { useCallback, useEffect, useMemo, useState } from 'react';
import { Joyride, STATUS, type EventData } from 'react-joyride';
import { useAppStore } from '@/app/store';
import { isCopilotUiEnabled } from '@/lib/featureFlags';

const STORAGE_KEY = 'docbrain_onboarding_tour_v1';

function useMdUp() {
  const [mdUp, setMdUp] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const fn = () => setMdUp(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  return mdUp;
}

function useJoyrideThemeColors() {
  const theme = useAppStore((s) => s.theme);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const apply = () => {
      if (theme === 'dark') setDark(true);
      else if (theme === 'light') setDark(false);
      else setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };
    apply();
    if (theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  return useMemo(
    () =>
      dark
        ? {
            primaryColor: '#60a5fa',
            backgroundColor: '#1e293b',
            textColor: '#f1f5f9',
            arrowColor: '#1e293b',
          }
        : {
            primaryColor: '#2563eb',
            backgroundColor: '#ffffff',
            textColor: '#0f172a',
            arrowColor: '#ffffff',
          },
    [dark],
  );
}

export function AppOnboarding() {
  const [run, setRun] = useState(false);
  const mdUp = useMdUp();
  const joyColors = useJoyrideThemeColors();

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = window.setTimeout(() => setRun(true), 600);
        return () => window.clearTimeout(t);
      }
    } catch {
      /* private mode */
    }
    return undefined;
  }, []);

  const onEvent = useCallback((data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
      setRun(false);
    }
  }, []);

  const steps = useMemo(() => {
    const search = {
      target: '[data-tour="header-search"]',
      title: 'Búsqueda global',
      content: 'Abre la paleta para buscar documentos, categorías y acciones rápidas (Ctrl+K).',
      skipBeacon: true,
    };
    const sidebar = {
      target: '[data-tour="sidebar-nav"]',
      title: 'Navegación',
      content: isCopilotUiEnabled()
        ? 'Accede a Documentos, Copilot, mapa de conocimiento y más. Puedes reordenar enlaces con el asa ⋮⋮.'
        : 'Accede a Documentos, búsqueda, mapa de conocimiento y más. Puedes reordenar enlaces con el asa ⋮⋮.',
    };
    const main = {
      target: '[data-tour="main-content"]',
      title: 'Área de trabajo',
      content: 'Aquí verás listas, el editor y el resto de pantallas. Consulta Ayuda para atajos.',
    };
    return mdUp ? [search, sidebar, main] : [search, main];
  }, [mdUp]);

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={onEvent}
      options={{
        buttons: ['back', 'skip', 'primary'],
        ...joyColors,
        zIndex: 100000,
      }}
      locale={{
        back: 'Atrás',
        close: 'Cerrar',
        last: 'Listo',
        next: 'Siguiente',
        skip: 'Omitir tour',
      }}
      styles={{
        tooltipContainer: {
          textAlign: 'left' as const,
        },
      }}
    />
  );
}
