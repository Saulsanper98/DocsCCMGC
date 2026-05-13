import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/app/store';
import type { Notification } from '@/shared/types';

export function useRealtimeNotifications() {
  const { user, setNotifications, notifications } = useAppStore();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications([newNotif, ...notifications]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, notifications.length]);
}

export function useRealtimeActivity(onNewActivity: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('activity_log_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        () => { onNewActivity(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [onNewActivity]);
}
