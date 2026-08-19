import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/** Présence en ligne (section 8) via Supabase Realtime Presence. */
export function usePresence(userId: string | null, username: string | null) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("presence:global", { config: { presence: { key: userId } } });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineUserIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ username, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, username]);

  return onlineUserIds;
}
