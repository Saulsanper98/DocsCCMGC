import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type PresencePeer = { userId: string; name: string };

/**
 * Presencia en tiempo real en un documento (Supabase Realtime Presence).
 */
export function useDocumentPresence(
  documentId: string | undefined,
  self: { id: string; full_name: string } | null,
) {
  const [peers, setPeers] = useState<PresencePeer[]>([]);

  useEffect(() => {
    if (!documentId || !self?.id) {
      setPeers([]);
      return;
    }

    const channel = supabase.channel(`presence:doc:${documentId}`, {
      config: { presence: { key: self.id } },
    });

    const applyState = () => {
      const state = channel.presenceState() as Record<string, { userId?: string; name?: string }[]>;
      const map = new Map<string, string>();
      for (const arr of Object.values(state)) {
        for (const p of arr ?? []) {
          if (p.userId && p.name && p.userId !== self.id) {
            map.set(p.userId, p.name);
          }
        }
      }
      setPeers([...map.entries()].map(([userId, name]) => ({ userId, name })));
    };

    channel
      .on('presence', { event: 'sync' }, applyState)
      .on('presence', { event: 'join' }, applyState)
      .on('presence', { event: 'leave' }, applyState);

    void channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId: self.id, name: self.full_name });
      }
    });

    return () => {
      void supabase.removeChannel(channel);
      setPeers([]);
    };
  }, [documentId, self?.id, self?.full_name]);

  return { peers };
}
