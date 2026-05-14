import { Button } from '@/shared/components/ui/Button';
import { Card } from '@/shared/components/ui/Card';
import { Input } from '@/shared/components/ui/Input';

/** Solo en desarrollo (`/dev/ui`): referencia visual de tokens y componentes base. */
export function DevUiPage() {
  return (
    <div className="app-page-x w-full max-w-none space-y-8 py-8">
      <div>
        <h1 className="app-page-title text-2xl font-bold text-[var(--foreground)]">Dev UI</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Ruta solo disponible en modo desarrollo. Úsala para comprobar contraste, foco y piezas reutilizables.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Texto</h2>
        <div className="space-y-1 text-sm">
          <p className="text-[var(--foreground)]">Foreground</p>
          <p className="text-[var(--muted-foreground)]">Muted foreground</p>
          <p className="text-[var(--accent)]">Accent</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Botones</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button">Primario</Button>
          <Button type="button" variant="outline">
            Contorno
          </Button>
          <Button type="button" variant="ghost">
            Ghost
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Formulario</h2>
        <Input placeholder="Campo de ejemplo" defaultValue="" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Tarjeta</h2>
        <Card elevation="raised" className="p-4 text-sm text-[var(--foreground)]">
          Contenido con sombra y borde según tema activo.
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Tabla numérica</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="app-table-numeric w-full text-sm">
            <thead className="bg-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Concepto</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--border)]">
                <td className="px-3 py-2">Ejemplo</td>
                <td className="px-3 py-2 text-right">12 345,67</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
