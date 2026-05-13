import { useLocation } from 'react-router-dom';

/** Transición de entrada al cambiar de ruta (solo el árbol envuelto). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition-enter flex-1 min-h-0 flex flex-col">
      {children}
    </div>
  );
}
