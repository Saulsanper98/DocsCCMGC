import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OnlineBanner() {
  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-500/35 bg-amber-500/12 px-3 py-1.5 text-center text-xs font-medium text-amber-950 dark:text-amber-100"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      Sin conexión a Internet. Los cambios pueden no guardarse hasta recuperar la red.
    </div>
  );
}
