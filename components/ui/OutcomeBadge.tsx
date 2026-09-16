import { Text, View } from "react-native";
import { Glow } from "@/components/ui/Glow";
import { OUTCOME_LABELS, OUTCOME_THEME } from "@/lib/theme";
import type { MatchOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Badge de résultat cinématique (Phase G.2 section 4) — destiné à RESULT
 * (G.4) et MATCH HISTORY (G.7). Distinct du `Badge` générique
 * (components/ui/Badge.tsx, inchangé, toujours utilisé partout ailleurs) :
 * celui-ci connaît directement `MatchOutcome` et sait s'entourer d'un halo
 * pour les moments forts. `glow` réservé aux reveals (jamais dans une liste
 * dense type historique) — et volontairement discret même sur WIN (audit
 * G.1 section I : émotionnel mais premium, jamais un effet infantilisant).
 */
export function OutcomeBadge({
  outcome,
  glow = false,
  className,
}: {
  outcome: MatchOutcome;
  glow?: boolean;
  className?: string;
}) {
  const theme = OUTCOME_THEME[outcome];
  const badge = (
    <View
      className={cn("self-start border px-3 py-1.5", className)}
      style={{ borderColor: `${theme.main}66`, backgroundColor: theme.soft }}
    >
      <Text className="text-xs font-extrabold uppercase tracking-wide" style={{ color: theme.text }}>
        {OUTCOME_LABELS[outcome]}
      </Text>
    </View>
  );

  if (!glow) return badge;
  return (
    <Glow tone={outcome === "WIN" ? "win" : outcome === "LOSS" ? "loss" : "draw"} intensity="sm">
      {badge}
    </Glow>
  );
}
