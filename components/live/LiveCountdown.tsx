import { useEffect, useState } from "react";
import { Text } from "react-native";
import { formatLiveRemaining } from "@/lib/live";
import { cn } from "@/lib/utils";

/** Compte à rebours visuel d'un LIVE recrutement — le serveur reste juge. */
export function LiveCountdown({ expiresAt, className }: { expiresAt: string | null; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Text className={cn("text-xs font-bold text-live", className)}>
      {formatLiveRemaining(expiresAt, now)}
    </Text>
  );
}
