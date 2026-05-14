import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { SlidersHorizontal, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useAppStore, type VisualComfort, type DocumentsTableDensity } from '@/app/store';
import { cn } from '@/shared/utils/cn';

const comfortOptions: { value: VisualComfort; label: string }[] = [
  { value: 'default', label: 'Estándar' },
  { value: 'high-contrast', label: 'Alto contraste' },
  { value: 'low-luminance', label: 'Baja luminancia' },
];

const tableDensityOptions: { value: DocumentsTableDensity; label: string }[] = [
  { value: 'inherit', label: 'Tabla = listado' },
  { value: 'comfortable', label: 'Tabla cómoda' },
  { value: 'compact', label: 'Tabla compacta' },
];

const breakOptions: { value: 0 | 55 | 90; label: string }[] = [
  { value: 0, label: 'Sin recordatorio' },
  { value: 55, label: 'Cada ~55 min' },
  { value: 90, label: 'Cada ~90 min' },
];

export function ComfortMenu() {
  const {
    visualComfort,
    setVisualComfort,
    footerCompact,
    setFooterCompact,
    breakReminderMinutes,
    setBreakReminderMinutes,
    soundsEnabled,
    setSoundsEnabled,
    documentsTableDensity,
    setDocumentsTableDensity,
  } = useAppStore();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-10 min-w-10 sm:min-h-9 sm:min-w-9"
          aria-label="Comodidad visual y bienestar"
          title="Comodidad visual (contraste, pie, pausas)"
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-[300] min-w-[14.5rem] rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1 shadow-xl"
          sideOffset={6}
          align="end"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Comodidad visual
          </DropdownMenu.Label>
          {comfortOptions.map((o) => (
            <DropdownMenu.Item
              key={o.value}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm outline-none',
                'hover:bg-[var(--muted)] focus:bg-[var(--muted)]',
              )}
              onSelect={(e) => {
                e.preventDefault();
                setVisualComfort(o.value);
              }}
            >
              {o.label}
              {visualComfort === o.value ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

          <DropdownMenu.Label className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Tabla de documentos
          </DropdownMenu.Label>
          {tableDensityOptions.map((o) => (
            <DropdownMenu.Item
              key={o.value}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm outline-none',
                'hover:bg-[var(--muted)] focus:bg-[var(--muted)]',
              )}
              onSelect={(e) => {
                e.preventDefault();
                setDocumentsTableDensity(o.value);
              }}
            >
              {o.label}
              {documentsTableDensity === o.value ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

          <DropdownMenu.Item
            className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm outline-none hover:bg-[var(--muted)] focus:bg-[var(--muted)]"
            onSelect={(e) => {
              e.preventDefault();
              setFooterCompact(!footerCompact);
            }}
          >
            Pie compacto
            {footerCompact ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
          </DropdownMenu.Item>

          <DropdownMenu.Label className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Pausas
          </DropdownMenu.Label>
          {breakOptions.map((o) => (
            <DropdownMenu.Item
              key={String(o.value)}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm outline-none',
                'hover:bg-[var(--muted)] focus:bg-[var(--muted)]',
              )}
              onSelect={(e) => {
                e.preventDefault();
                setBreakReminderMinutes(o.value);
              }}
            >
              {o.label}
              {breakReminderMinutes === o.value ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

          <DropdownMenu.Item
            className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm outline-none hover:bg-[var(--muted)] focus:bg-[var(--muted)]"
            onSelect={(e) => {
              e.preventDefault();
              setSoundsEnabled(!soundsEnabled);
            }}
          >
            Sonidos UI
            {soundsEnabled ? <Check className="h-4 w-4 text-[var(--accent)]" /> : <span className="text-xs text-[var(--muted-foreground)]">Off</span>}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
