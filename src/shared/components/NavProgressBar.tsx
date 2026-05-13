import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';

export function NavProgressBar() {
  const { state } = useNavigation();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state === 'loading') {
      setVisible(true);
      setWidth(30);
      const t1 = setTimeout(() => setWidth(60), 150);
      const t2 = setTimeout(() => setWidth(80), 500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else if (state === 'idle' && visible) {
      setWidth(100);
      const t = setTimeout(() => { setVisible(false); setWidth(0); }, 300);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[2px] overflow-hidden',
      )}
    >
      <div
        className={cn(
          'h-full bg-gradient-to-r from-[var(--brand-400)] via-[var(--accent)] to-[var(--brand-300)]',
          'transition-[width,opacity] duration-300 ease-out',
          'shadow-[0_0_8px_rgba(59,130,246,0.45)]',
        )}
        style={{ width: `${width}%`, opacity: width === 100 ? 0 : 1 }}
      />
    </div>
  );
}
