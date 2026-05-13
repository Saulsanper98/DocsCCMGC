import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Shield,
  LayoutGrid,
  Users,
  Server,
  Plug,
  BookOpen,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/app/store';
import { copilot } from '@/lib/copilot';
import { getAiBackend, isCopilotUiEnabled } from '@/lib/featureFlags';
import { AdminUsersSection } from './AdminUsersSection';
import { Card } from '@/shared/components/ui/Card';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { cn } from '@/shared/utils/cn';
import { Button } from '@/shared/components/ui/Button';

const TAB_IDS = ['overview', 'team', 'system', 'integrations'] as const;
type AdminTab = (typeof TAB_IDS)[number];

function isAdminTab(v: string): v is AdminTab {
  return (TAB_IDS as readonly string[]).includes(v);
}

function safeHost(raw: string | undefined): string {
  if (!raw) return '—';
  try {
    return new URL(raw).hostname;
  } catch {
    return '(no válido)';
  }
}

const tabTriggerClass =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] outline-none transition-colors hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[state=active]:bg-[var(--muted)] data-[state=active]:text-[var(--foreground)]';

const linkBtnSecondary =
  'inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-sm font-medium text-[var(--secondary-foreground)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--muted)]';

export function AdminPage() {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') ?? '';
  const tab: AdminTab = isAdminTab(rawTab) ? rawTab : 'overview';

  const setTab = (next: AdminTab) => {
    if (next === 'overview') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: next }, { replace: true });
    }
  };

  const [statsLoading, setStatsLoading] = useState(true);
  const [profileCount, setProfileCount] = useState<number | null>(null);
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    void Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true }),
    ]).then(([profiles, docs]) => {
      if (cancelled) return;
      setProfileCount(profiles.count ?? 0);
      setDocCount(docs.count ?? 0);
      setStatsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const appName = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'DocsBrain';
  const mode = import.meta.env.MODE;
  const azureEp = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string | undefined;
  const azureKeySet = !!(import.meta.env.VITE_AZURE_OPENAI_KEY as string | undefined)?.trim();
  const deployment =
    (import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT as string | undefined)?.trim() || 'gpt-4o';
  const aiBackend = getAiBackend();
  const ollamaBase =
    (import.meta.env.VITE_OLLAMA_URL as string | undefined)?.trim().replace(/\/$/, '') || 'http://127.0.0.1:11434';
  const ollamaModelName =
    (import.meta.env.VITE_OLLAMA_MODEL as string | undefined)?.trim() || 'llama3.2';
  const iaUiEnabled = isCopilotUiEnabled();
  const copilotReady = copilot.isConfigured();

  const integrationRows = [
    {
      name: 'IA asistente',
      ok: iaUiEnabled && copilotReady,
      detail: !iaUiEnabled
        ? 'Activa un proveedor: VITE_AI_PROVIDER=ollama (Ollama local, sin coste de API) o Azure con VITE_AI_PROVIDER=azure (o VITE_ENABLE_COPILOT=true) y credenciales.'
        : aiBackend === 'ollama' && copilotReady
          ? `Ollama · host ${safeHost(ollamaBase)} · modelo ${ollamaModelName} · sin API de pago.`
          : aiBackend === 'azure' && copilotReady
            ? `Azure OpenAI · despliegue ${deployment} · host ${safeHost(azureEp)}`
            : 'Proveedor Azure activo pero faltan endpoint o clave en .env.',
    },
    {
      name: 'Supabase',
      ok: !!supabaseUrl?.trim(),
      detail: supabaseUrl ? `Proyecto (host): ${safeHost(supabaseUrl)}` : 'VITE_SUPABASE_URL no definida',
    },
  ];

  if (user?.role !== 'admin') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <Shield className="mx-auto mb-3 h-12 w-12 text-[var(--muted-foreground)] opacity-40" aria-hidden />
          <p className="text-[var(--muted-foreground)]">No tienes permisos para acceder a la administración.</p>
          <Link to="/" className={cn(linkBtnSecondary, 'mt-4')}>
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="shrink-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Administración</h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          Consola central para el equipo, el entorno de ejecución y las integraciones. Los cambios sensibles se
          configuran en el servidor o en el fichero <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-xs">.env</code>.
        </p>
      </header>

      <Tabs.Root value={tab} onValueChange={(v) => isAdminTab(v) && setTab(v)} className="flex min-h-0 flex-1 flex-col gap-4">
        <Tabs.List
          className="flex shrink-0 flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--shadow-sm)]"
          aria-label="Secciones de administración"
        >
          <Tabs.Trigger value="overview" className={tabTriggerClass}>
            <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
            Resumen
          </Tabs.Trigger>
          <Tabs.Trigger value="team" className={tabTriggerClass}>
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            Equipo y roles
          </Tabs.Trigger>
          <Tabs.Trigger value="system" className={tabTriggerClass}>
            <Server className="h-4 w-4 shrink-0" aria-hidden />
            Sistema
          </Tabs.Trigger>
          <Tabs.Trigger value="integrations" className={tabTriggerClass}>
            <Plug className="h-4 w-4 shrink-0" aria-hidden />
            Integraciones
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Perfiles
                  </p>
                  {statsLoading ? (
                    <Skeleton className="mt-2 h-9 w-16" />
                  ) : (
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--foreground)]">
                      {profileCount ?? '—'}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    Usuarios con perfil en Supabase Auth.
                  </p>
                </div>
                <Users className="h-9 w-9 shrink-0 text-[var(--muted-foreground)] opacity-50" aria-hidden />
              </div>
              <Button variant="ghost" size="sm" className="mt-4 -ml-2 h-8" type="button" onClick={() => setTab('team')}>
                Gestionar equipo
              </Button>
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Documentos
                  </p>
                  {statsLoading ? (
                    <Skeleton className="mt-2 h-9 w-16" />
                  ) : (
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--foreground)]">
                      {docCount ?? '—'}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">Filas en la tabla documents.</p>
                </div>
                <FileText className="h-9 w-9 shrink-0 text-[var(--muted-foreground)] opacity-50" aria-hidden />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 -ml-2 h-8"
                type="button"
                onClick={() => navigate('/documentos')}
              >
                Ir a documentos
              </Button>
            </Card>

            <Card className="p-5 sm:col-span-2 lg:col-span-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Asistente IA
                  </p>
                  <p
                    className={cn(
                      'mt-2 inline-flex items-center gap-1.5 text-sm font-medium',
                      iaUiEnabled && copilotReady
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-[var(--muted-foreground)]',
                    )}
                  >
                    {!iaUiEnabled ? (
                      <>
                        <XCircle className="h-4 w-4" aria-hidden />
                        No contratado
                      </>
                    ) : copilotReady ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        Listo para usar
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" aria-hidden />
                        Sin credenciales Azure
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    {iaUiEnabled
                      ? 'Variables Azure en el cliente (solo lectura aquí).'
                      : 'La importación OCR y la documentación funcionan sin IA en la nube.'}
                  </p>
                </div>
                <Plug className="h-9 w-9 shrink-0 text-[var(--muted-foreground)] opacity-50" aria-hidden />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" className="h-8" type="button" onClick={() => setTab('integrations')}>
                  Ver integraciones
                </Button>
                {iaUiEnabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  type="button"
                  onClick={() => navigate('/copilot')}
                >
                  Abrir asistente IA
                </Button>
                )}
              </div>
            </Card>
          </div>

          <Card className="mt-4 p-5" elevation="flat">
            <div className="flex flex-wrap items-center gap-3">
              <BookOpen className="h-5 w-5 text-[var(--muted-foreground)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--foreground)]">Ayuda y buenas prácticas</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Documentación interna, atajos y flujos recomendados.
                </p>
              </div>
              <Link to="/ayuda" className={cn(linkBtnSecondary, 'inline-flex items-center gap-1.5 text-sm')}>
                Centro de ayuda
                <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </Link>
            </div>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="team" className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden">
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Equipo y roles</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Asigna roles de acceso. Los cambios aplican en la tabla <code className="text-xs">profiles</code>.
            </p>
            <div className="mt-6">
              <AdminUsersSection />
            </div>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="system" className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden">
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3 sm:px-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Entorno (solo lectura)</h2>
              <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                No se muestran secretos (claves API, tokens). Configúralos en despliegue o en{' '}
                <code className="rounded bg-[var(--muted)] px-1 text-xs">.env</code>.
              </p>
            </div>
            <dl className="grid divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-y-0">
              {[
                { term: 'Aplicación', desc: appName },
                { term: 'Modo Vite', desc: mode },
                { term: 'Supabase (host)', desc: safeHost(supabaseUrl) },
                {
                  term: 'Proveedor IA',
                  desc: aiBackend === 'ollama' ? 'Ollama (local)' : aiBackend === 'azure' ? 'Azure OpenAI' : '—',
                },
                {
                  term: 'Ollama (URL)',
                  desc: aiBackend === 'ollama' ? safeHost(ollamaBase) : '—',
                },
                {
                  term: 'Ollama (modelo)',
                  desc: aiBackend === 'ollama' ? ollamaModelName : '—',
                },
                {
                  term: 'Azure OpenAI (host)',
                  desc: azureEp?.trim() ? safeHost(azureEp) : '—',
                },
                {
                  term: 'Clave Azure (estado)',
                  desc: azureKeySet ? 'Definida en build (valor oculto)' : 'No definida',
                },
                { term: 'Despliegue modelo', desc: deployment },
              ].map((row) => (
                <div key={row.term} className="flex flex-col gap-0.5 px-4 py-3 sm:px-6">
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    {row.term}
                  </dt>
                  <dd className="text-sm text-[var(--foreground)]">{row.desc}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="integrations" className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden">
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--border)] px-4 py-3 sm:px-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Estado de integraciones</h2>
              <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                Vista rápida para diagnóstico. Para cambiar credenciales, actualiza el entorno y vuelve a desplegar.
              </p>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {integrationRows.map((row) => (
                <li key={row.name} className="flex flex-wrap items-start gap-3 px-4 py-4 sm:px-6">
                  {row.ok ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--foreground)]">{row.name}</p>
                    <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{row.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-[var(--border)] bg-[var(--muted)]/20 px-4 py-3 sm:px-6">
              <p className="text-xs text-[var(--muted-foreground)]">
                Asistente gratuito: <code className="rounded bg-[var(--muted)] px-1 text-xs">VITE_AI_PROVIDER=ollama</code>{' '}
                y Ollama accesible desde el navegador (CORS y HTTPS según tu despliegue). Azure OpenAI solo con contrato:{' '}
                <code className="rounded bg-[var(--muted)] px-1 text-xs">VITE_AI_PROVIDER=azure</code> o{' '}
                <code className="rounded bg-[var(--muted)] px-1 text-xs">VITE_ENABLE_COPILOT=true</code>. La importación
                OCR de PDFs no depende de estos proveedores. Autenticación y datos: Supabase.
              </p>
            </div>
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
