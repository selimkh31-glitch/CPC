import { useEffect, useState } from "react";
import { Text } from "react-native";
import { cn } from "@/lib/utils";

/**
 * Countdown purement visuel (Phase 5, Étape 4, section 4) — aucune logique
 * métier : n'affiche qu'une estimation locale du temps restant avant
 * `expiresAt`. Le serveur (resolve-expired-departures, cron) reste seul juge
 * de l'expiration réelle ; ce composant ne déclenche jamais rien.
 */
export function DepartureCountdown({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = new Date(expiresAt).getTime() - now;

  if (remainingMs <= 0) {
    return <Text className={cn("text-sm font-bold text-fg-subtle", className)}>En cours de traitement…</Text>;
  }

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);

  return (
    <Text className={cn("text-sm font-bold text-warn", className)}>
      {minutes}:{seconds.toString().padStart(2, "0")} restant
    </Text>
  );
}
