import { useEffect, useState, type RefObject } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export function ScrollToTop({ scrollContainerRef }: { scrollContainerRef?: RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollContainerRef?.current ?? document.getElementById('main-content');
    if (!el) return;
    const html = el as HTMLElement;

    const onScroll = () => setVisible(html.scrollTop > 400);
    onScroll();
    html.addEventListener('scroll', onScroll, { passive: true });
    return () => html.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef]);

  function scrollTop() {
    const el = scrollContainerRef?.current ?? document.getElementById('main-content');
    if (el) (el as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <button
      type="button"
      onClick={scrollTop}
      aria-label="Volver al inicio"
      className={cn(
        'fixed bottom-6 right-6 z-[45] h-10 w-10 rounded-full',
        'flex items-center justify-center',
        'bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow-lg)]',
        'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:shadow-[var(--shadow-xl)]',
        'transition-all duration-200',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
      )}
    >
      <ChevronUp className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}
