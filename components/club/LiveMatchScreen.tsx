import { View } from "react-native";
import { Flag, PlayCircle } from "lucide-react-native";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CinematicCard } from "@/components/ui/CinematicCard";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { StepTransition } from "@/components/ui/StepTransition";
import { Caption, DisplayMD } from "@/components/ui/Typography";
import { MatchContextCards } from "@/components/club/MatchContextCards";
import { useElapsedSeconds, formatSinceMinutes } from "@/lib/hooks/useElapsedSeconds";
import type { MatchParticipantRow } from "@/lib/types";

type MatchDayStatus = "ready" | "live";

/**
 * Corps du Match Day Cockpit (Phase G.3.2) — remplace le takeover plein-écran
 * de G.3 (abandonné, voir audit G.3.1 : "CINEMATIC ne signifie pas
 * fullscreen"). Rendu comme une `CinematicCard` embarquée dans le scroll
 * normal de match.tsx (jamais un `CinematicScreen` séparé) : le manager
 * garde la tab bar, le club switcher et l'accès aux réglages visibles autour.
 *
 * Deux sous-états purement locaux :
 * - `"ready"` (MATCH PRÊT) : juste après un lancement FRAIS de check-in dans
 *   CE montage — jamais après une restauration serveur (voir
 *   MatchCheckinPanel.tsx, on ne peut pas savoir si le coup d'envoi a déjà
 *   été donné dans une session précédente : aucune donnée `kickoff_at`
 *   n'existe, voir audit G.3.1 section B — pas de persistance inventée ici).
 * - `"live"` (MATCH EN COURS) : `launchedAt` n'est PAS un coup d'envoi réel,
 *   donc jamais affiché avec la hiérarchie visuelle d'un chrono/score (pas
 *   de MM:SS géant) — juste une mention discrète et honnête
 *   (`formatSinceMinutes`). Le vrai Match Clock Engine est G.3.4, pas ici.
 */
export function LiveMatchScreen({
  status,
  clubId,
  launchedAt,
  participants,
  participantsLoading,
  onKickoff,
  onFinalize,
}: {
  status: MatchDayStatus;
  clubId: string;
  launchedAt: string;
  participants: MatchParticipantRow[];
  participantsLoading: boolean;
  onKickoff: () => void;
  onFinalize: () => void;
}) {
  // Le hook peut rester techniquement nécessaire (G.3.2 section 10) mais
  // n'alimente qu'un texte discret, jamais un chiffre central — et seulement
  // une fois le match réellement en cours (pas en "ready").
  const elapsedSeconds = useElapsedSeconds(status === "live" ? launchedAt : null);
  const presentCount = participants.length;

  return (
    <CinematicCard tone={status === "live" ? "accent" : "neutral"}>
      <StepTransition stepKey={status} kind="fade">
        <View className="gap-5">
          {/* MATCH STATE */}
          <View className="items-center gap-1.5">
            {status === "live" ? <LiveIndicator /> : <Badge tone="neutral">Prêt</Badge>}
            <DisplayMD>{status === "live" ? "Match en cours" : "Match prêt"}</DisplayMD>
            <Caption>
              {status === "live"
                ? formatSinceMinutes(elapsedSeconds)
                : `${presentCount} joueur${presentCount > 1 ? "s" : ""} confirmé${presentCount > 1 ? "s" : ""}`}
            </Caption>
          </View>

          {/* MATCH CONTEXT */}
          <MatchContextCards clubId={clubId} />

          {/* ACTIONS */}
          {status === "ready" ? (
            <Button icon={<PlayCircle size={18} color="#08090b" />} onPress={onKickoff}>
              Coup d'envoi
            </Button>
          ) : (
            <Button icon={<Flag size={18} color="#08090b" />} onPress={onFinalize}>
              Terminer le match
            </Button>
          )}

          {/* MATCH INFO — effectif présent, priorité la plus basse (audit
              G.3.1 section E) : uniquement une fois le match en cours, le
              statut "ready" se contente du compte ci-dessus. */}
          {status === "live" && (participantsLoading || presentCount > 0) && (
            <View className="items-center gap-2">
              <Caption className="uppercase tracking-widest">Votre équipe</Caption>
              {participantsLoading ? (
                <Skeleton className="h-11 w-44 rounded-full" />
              ) : (
                <View className="flex-row flex-wrap items-center justify-center gap-2">
                  {participants.map((p) => (
                    <Avatar key={p.user_id} username={p.username} size="sm" />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </StepTransition>
    </CinematicCard>
  );
}
