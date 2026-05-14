import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, FileEdit, AtSign, CheckCircle2 } from 'lucide-react';
import { format, isThisWeek, isToday, isYesterday, parseISO } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/app/store';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { formatRelativeTime } from '@/shared/utils/format';
import { cn } from '@/shared/utils/cn';
import type { Notification } from '@/shared/types';

const typeConfig = {
  mention: { icon: AtSign, label: 'te mencionó', color: 'text-blue-500' },
  update: { icon: FileEdit, label: 'actualizó', color: 'text-emerald-500' },
  comment: { icon: MessageSquare, label: 'comentó en', color: 'text-amber-500' },
  review_request: { icon: CheckCircle2, label: 'solicita revisión de', color: 'text-violet-500' },
};

function groupLabel(date: Date): string {
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  if (isThisWeek(date, { weekStartsOn: 1 })) {
    return format(date, "EEEE", { locale: esLocale });
  }
  return format(date, "d MMMM yyyy", { locale: esLocale });
}

function groupNotifications(sorted: Notification[]): { label: string; items: Notification[] }[] {
  const out: { label: string; items: Notification[] }[] = [];
  let last = '';
  for (const n of sorted) {
    const d = parseISO(n.created_at);
    const label = groupLabel(d);
    if (label !== last) {
      last = label;
      out.push({ label, items: [n] });
    } else {
      out[out.length - 1].items.push(n);
    }
  }
  return out;
}

export function NotificationsPage() {
  const { notifications, unreadCount, setNotifications, markNotificationRead, markAllNotificationsRead, user } =
    useAppStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*, document:documents(id,title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    markNotificationRead(id);
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    markAllNotificationsRead();
  }

  const sections = useMemo(() => {
    const sorted = [...notifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return groupNotifications(sorted);
  }, [notifications]);

  return (
    <div className="app-page-x w-full max-w-none py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[var(--muted-foreground)] mt-1">{unreadCount} sin leer</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            <CheckCircle2 className="w-4 h-4" />
            Marcar todo como leído
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 border border-[var(--border)] rounded-xl">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No hay notificaciones"
          description="Cuando alguien te mencione o actualice un documento que sigues, lo verás aquí."
        />
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.label} aria-labelledby={`notif-${section.label}`}>
              <h2
                id={`notif-${section.label}`}
                className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-3"
              >
                {section.label}
              </h2>
              <div className="space-y-2">
                {section.items.map((notif) => {
                  const config = typeConfig[notif.type];
                  const Icon = config.icon;

                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer',
                        notif.is_read
                          ? 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]'
                          : 'border-[var(--accent)]/30 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                      )}
                      onClick={() => {
                        markRead(notif.id);
                        if (notif.document_id) navigate(`/documentos/${notif.document_id}`);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          markRead(notif.id);
                          if (notif.document_id) navigate(`/documentos/${notif.document_id}`);
                        }
                      }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[var(--muted)]">
                        <Icon className={cn('w-4 h-4', config.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--foreground)]">
                          <span className="font-semibold">{notif.title}</span>
                        </p>
                        {notif.body && (
                          <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">{notif.body}</p>
                        )}
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                          {formatRelativeTime(notif.created_at)}
                        </p>
                      </div>

                      {!notif.is_read && (
                        <div className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0 mt-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
