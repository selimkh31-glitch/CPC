import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, PlayCircle, UserX, Users, Flag, Trophy } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { LiveMatchScreen } from "@/components/club/LiveMatchScreen";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { FORMATIONS, type FormationId } from "@/lib/formations";
import {
  useActiveMatchCheckin,
  useFinalizeMatch,
  useLaunchMatchCheckin,
  useMatchParticipants,
  type MatchCheckinResult,
} from "@/lib/hooks/useMatchCheckin";
import { toast } from "@/lib/toast";
import type { ClubMemberRow, MatchOutcome, MatchResultRow, SlotAssignmentRow } from "@/lib/types";

type Step = "idle" | "confirm" | "absences" | "ready" | "live" | "finalize" | "finalized";

const OUTCOME_LABELS: Record<MatchOutcome, string> = { WIN: "Victoire", DRAW: "Match nul", LOSS: "Défaite" };
const OUTCOME_TONES: Record<MatchOutcome, "accent" | "warn" | "danger"> = { WIN: "accent", DRAW: "warn", LOSS: "danger" };

/**
 * Check-in / lancement du match (Phase 5, Étape 3) — owner/manager only,
 * rendu par le parent uniquement si `canManage` (aucune re-vérification de
 * rôle ici, comme FormationSelector). Toute écriture passe exclusivement par
 * launch-match-checkin via useLaunchMatchCheckin — jamais d'accès direct
 * client à match_checkins/match_participations/matches_played_count.
 */
export function MatchCheckinPanel({
  clubId,
  sessionId,
  formationId,
  assignments,
  members,
  onLiveChange,
}: {
  clubId: string;
  /** Session live du club — null si aucune, auquel cas le check-in est bloqué
   *  avec un message explicite (Étape 3, section 6 : pas de check-in "hors
   *  session"). */
  sessionId: string | null;
  /** Formation courante — uniquement pour traduire slot_id en libellé de
   *  poste lisible (lib/formations.ts reste l'unique source de vérité,
   *  jamais dupliquée ici). */
  formationId: FormationId;
  /** Titulaires actuels (slot_assignments) — source de vérité, aucun état
   *  parallèle recréé ici. */
  assignments: SlotAssignmentRow[];
  /** Tous les membres du club — utilisé uniquement pour résoudre les pseudos
   *  des absents après coup (leur ligne slot_assignments a été supprimée par
   *  le backend, mais ils restent membres). */
  members: ClubMemberRow[];
  /**
   * Phase G.3/G.3.2 — signale au parent (match.tsx) que ce panel affiche
   * actuellement un état "Match Day" (ready/live/finalize/finalized), pour
   * qu'il puisse replier la section "Préparation" (formation, banc, session,
   * vocal, invitations) pendant ce temps — sans dupliquer/déplacer la state
   * machine `step`, qui reste 100% locale à ce composant. Optionnel : aucun
   * changement de comportement si non fourni.
   */
  onLiveChange?: (isMatchDay: boolean) => void;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [selectedAbsentIds, setSelectedAbsentIds] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<MatchCheckinResult | null>(null);
  const launch = useLaunchMatchCheckin(clubId);
  // Phase F.1 — source de vérité SERVEUR pour "un check-in de ce club est
  // actif" (pas encore de match_results). Remplace la dépendance exclusive à
  // `lastResult` (état local perdu à la navigation/au reload) : au premier
  // rendu de CE montage, si le serveur dit qu'un check-in est actif, on
  // restaure l'écran "Match en cours" au lieu de repartir de idle — sans
  // jamais recréer de check-in nous-mêmes (aucune écriture ici).
  const {
    data: activeCheckin,
    isLoading: activeCheckinLoading,
    isError: activeCheckinError,
    refetch: refetchActiveCheckin,
  } = useActiveMatchCheckin(clubId);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current || activeCheckinLoading) return;
    restoredRef.current = true;
    // Phase G.3.2 — jamais "ready" ici : une restauration serveur ne permet
    // pas de savoir si le coup d'envoi a déjà été donné dans une session
    // précédente (aucune donnée `kickoff_at` n'existe, voir audit G.3.1
    // section B) — "live" est l'hypothèse honnête par défaut. "ready" n'est
    // atteignable que juste après un lancement FRAIS dans CE montage (voir
    // doLaunch plus bas), jamais reconstruit depuis le serveur.
    if (activeCheckin) setStep("live");
  }, [activeCheckin, activeCheckinLoading]);

  // Phase F.2 — finalisation. `activeCheckinId` couvre les deux origines
  // possibles du check-in affiché : juste lancé dans CE montage (lastResult)
  // ou restauré depuis le serveur (activeCheckin, voir Phase F.1) — dans les
  // deux cas c'est le même check-in réel, jamais recréé.
  const activeCheckinId = lastResult?.checkin.id ?? activeCheckin?.id ?? null;
  const { data: participants, isLoading: participantsLoading } = useMatchParticipants(activeCheckinId);
  const finalize = useFinalizeMatch(clubId);
  const [ourScoreInput, setOurScoreInput] = useState("");
  const [opponentScoreInput, setOpponentScoreInput] = useState("");
  const [mvpUserId, setMvpUserId] = useState<string[]>([]);
  const [finalizedResult, setFinalizedResult] = useState<MatchResultRow | null>(null);

  // Phase G.3.2 — "Match Day" au sens du parent = tout step qui n'est plus
  // la préparation (ready/live/finalize/finalized). idle/confirm/absences
  // restent la phase de préparation, jamais repliée.
  const isMatchDay = step === "ready" || step === "live" || step === "finalize" || step === "finalized";
  useEffect(() => {
    onLiveChange?.(isMatchDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMatchDay]);

  const titulaires = assignments.filter((a) => a.user);
  const positionBySlotId = new Map<string, PositionCode>(FORMATIONS[formationId].map((s) => [s.slotId, s.position]));
  const slotLabel = (slotId: string) => {
    const position = positionBySlotId.get(slotId);
    return position ? POSITION_LABELS[position] : slotId;
  };

  const reset = () => {
    setStep("idle");
    setSelectedAbsentIds([]);
    setLastResult(null);
    setOurScoreInput("");
    setOpponentScoreInput("");
    setMvpUserId([]);
    setFinalizedResult(null);
  };

  const doLaunch = (absentUserIds: string[]) => {
    if (!sessionId) return;
    launch.mutate(
      { sessionId, absentUserIds },
      {
        onSuccess: (result) => {
          setLastResult(result);
          // Phase G.3.2 — "ready" (MATCH PRÊT), pas encore "live" : le coup
          // d'envoi est un geste manager explicite, purement local (voir
          // LiveMatchScreen.tsx et le rapport section C).
          setStep("ready");
          toast.success(
            result.finalizedDepartures.length > 0
              ? `Match lancé — ${result.finalizedDepartures.length} transfert(s) finalisé(s) !`
              : "Match lancé !"
          );
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  // Bornes UI uniquement (0-99) — l'Edge Function applique déjà cette
  // validation (requireIntInRange côté finalize-match) ; ce n'est qu'un
  // garde-fou de saisie, jamais une règle métier dupliquée.
  const isScoreValid = ourScoreInput !== "" && opponentScoreInput !== "";

  const submitFinalize = () => {
    if (!activeCheckinId || !isScoreValid || finalize.isPending) return;
    finalize.mutate(
      {
        matchCheckinId: activeCheckinId,
        ourScore: Number(ourScoreInput),
        opponentScore: Number(opponentScoreInput),
        mvpUserId: mvpUserId[0] ?? null,
      },
      {
        onSuccess: ({ matchResult }) => {
          setFinalizedResult(matchResult);
          setStep("finalized");
          toast.success("Résultat enregistré !");
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  if (step === "finalized" && finalizedResult) {
    const mvp = finalizedResult.mvp_user_id
      ? (participants ?? []).find((p) => p.user_id === finalizedResult.mvp_user_id)
      : null;

    // Phase G.3.2 — retour à une carte embarquée normale (le takeover
    // plein-écran de G.3 est abandonné, voir audit G.3.1 : "CINEMATIC ne
    // signifie pas fullscreen"). Contenu STRICTEMENT identique à la Phase
    // F.2. Le reveal RESULT (glow outcome, gros chiffres, spotlight MVP) est
    // explicitement hors périmètre de cette phase — G.4.
    return (
      <Card>
        <CardHeader>
          <CardTitle icon={<Trophy size={18} color="#39ff8a" />}>Match terminé</CardTitle>
        </CardHeader>
        <View className="items-center gap-2 py-2">
          <Badge tone={OUTCOME_TONES[finalizedResult.outcome]}>{OUTCOME_LABELS[finalizedResult.outcome]}</Badge>
          <Text className="font-display text-3xl text-fg">
            {finalizedResult.our_score} — {finalizedResult.opponent_score}
          </Text>
          {mvp && <Text className="text-sm text-fg-muted">MVP : {mvp.username}</Text>}
        </View>
        <Button variant="secondary" className="mt-2" onPress={reset}>
          Nouveau check-in
        </Button>
      </Card>
    );
  }

  if (step === "finalize" && activeCheckinId) {
    // Phase G.3.2 — même retour à une carte embarquée (voir ci-dessus).
    // Contenu du formulaire strictement inchangé depuis la Phase F.2 —
    // l'upgrade visuel (steppers, grille d'avatars MVP) est hors périmètre.
    return (
      <Card>
        <CardHeader>
          <CardTitle icon={<Flag size={18} color="#f4f5f7" />}>Terminer le match</CardTitle>
        </CardHeader>
        <View className="gap-4">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Label>Notre équipe</Label>
              <Input
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0"
                value={ourScoreInput}
                onChangeText={(t) => setOurScoreInput(t.replace(/[^0-9]/g, "").slice(0, 2))}
              />
            </View>
            <View className="flex-1">
              <Label>Adversaire</Label>
              <Input
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0"
                value={opponentScoreInput}
                onChangeText={(t) => setOpponentScoreInput(t.replace(/[^0-9]/g, "").slice(0, 2))}
              />
            </View>
          </View>
          <View>
            <Label>MVP (optionnel)</Label>
            {participantsLoading ? (
              <Skeleton className="h-10" />
            ) : (participants ?? []).length === 0 ? (
              <Text className="text-sm text-fg-muted">Aucun joueur présent à ce check-in.</Text>
            ) : (
              <View className="gap-1">
                {(participants ?? []).map((p) => {
                  const selected = mvpUserId[0] === p.user_id;
                  return (
                    <Pressable
                      key={p.user_id}
                      onPress={() => setMvpUserId(selected ? [] : [p.user_id])}
                      className={`min-h-[44px] flex-row items-center justify-between rounded-xl px-3 ${
                        selected ? "bg-accent/15" : "bg-bg-elevated"
                      }`}
                    >
                      <Text className={`font-semibold ${selected ? "text-accent" : "text-fg"}`}>{p.username}</Text>
                      {selected ? <Check size={18} color="#39ff8a" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
          <View className="gap-2">
            <Button loading={finalize.isPending} disabled={!isScoreValid} onPress={submitFinalize}>
              Valider le résultat
            </Button>
            <Button variant="secondary" onPress={() => setStep("live")}>
              Annuler
            </Button>
          </View>
        </View>
      </Card>
    );
  }

  if ((step === "ready" || step === "live") && (lastResult || activeCheckin)) {
    // Phase G.3.2 — cockpit non plein-écran (LiveMatchScreen reconstruit,
    // voir ce fichier). `launchedAt` vient de la même source qu'avant
    // (lastResult.checkin ou activeCheckin, hooks F.1/F.2 inchangés) — pure
    // donnée d'affichage, jamais recalculée, jamais présentée comme un coup
    // d'envoi réel (voir LiveMatchScreen.tsx).
    const launchedAt = lastResult?.checkin.launched_at ?? activeCheckin?.launched_at ?? null;
    if (!launchedAt) return null; // défensif — ne peut pas arriver vu la garde ci-dessus

    return (
      <LiveMatchScreen
        status={step}
        clubId={clubId}
        launchedAt={launchedAt}
        participants={participants ?? []}
        participantsLoading={participantsLoading}
        onKickoff={() => setStep("live")}
        onFinalize={() => setStep("finalize")}
      />
    );
  }

  if (step === "absences") {
    return (
      <Card>
        <CardHeader>
          <CardTitle icon={<UserX size={18} color="#f4f5f7" />}>Qui est absent ?</CardTitle>
        </CardHeader>
        {titulaires.length === 0 ? (
          <Text className="text-sm text-fg-muted">Aucun titulaire sur la feuille — le check-in partira d&apos;un 11 vide.</Text>
        ) : (
          <View className="gap-1">
            {titulaires.map((a) => {
              const selected = selectedAbsentIds.includes(a.user_id);
              const label = a.user?.username ?? slotLabel(a.slot_id);
              return (
                <Pressable
                  key={a.user_id}
                  onPress={() =>
                    setSelectedAbsentIds((ids) =>
                      ids.includes(a.user_id) ? ids.filter((id) => id !== a.user_id) : [...ids, a.user_id]
                    )
                  }
                  className={`min-h-[44px] flex-row items-center justify-between rounded-xl px-3 ${
                    selected ? "bg-danger/10" : "bg-bg-elevated"
                  }`}
                >
                  <Text className={`font-semibold ${selected ? "text-danger" : "text-fg"}`}>
                    {slotLabel(a.slot_id)} — {label}
                  </Text>
                  {selected ? <Check size={18} color="#ff4d6a" /> : null}
                </Pressable>
              );
            })}
          </View>
        )}
        <View className="mt-4 flex-row gap-2">
          <Button variant="secondary" className="flex-1" onPress={() => setStep("confirm")}>
            Annuler
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            loading={launch.isPending}
            onPress={() => doLaunch(selectedAbsentIds)}
          >
            {selectedAbsentIds.length > 0
              ? `Confirmer ${selectedAbsentIds.length} absence(s)`
              : "Confirmer (aucune absence)"}
          </Button>
        </View>
      </Card>
    );
  }

  if (step === "confirm") {
    return (
      <Card>
        <CardHeader>
          <CardTitle icon={<Users size={18} color="#f4f5f7" />}>Prêt à lancer ?</CardTitle>
          <Text className="text-sm text-fg-muted">{titulaires.length}/11</Text>
        </CardHeader>
        <View className="mb-4 gap-1">
          {titulaires.map((a) => (
            <Text key={a.slot_id} numberOfLines={1} className="text-sm text-fg">
              {slotLabel(a.slot_id)} — {a.user?.username ?? "Joueur"}
            </Text>
          ))}
        </View>
        <View className="gap-2">
          <Button loading={launch.isPending} onPress={() => doLaunch([])}>
            Tout le monde est présent
          </Button>
          <Button variant="secondary" icon={<UserX size={16} color="#f4f5f7" />} onPress={() => setStep("absences")}>
            Signaler une absence
          </Button>
        </View>
      </Card>
    );
  }

  // idle
  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<PlayCircle size={18} color="#f4f5f7" />}>Check-in</CardTitle>
      </CardHeader>
      {activeCheckinError ? (
        // Phase G.3 section 11.E — jamais laisser cet écran silencieusement
        // sur "idle" si la restauration du check-in actif a échoué (elle
        // pourrait en réalité être en cours ailleurs) : système d'erreur
        // existant (ErrorState, déjà utilisé par match.tsx/PendingInvitations),
        // aucune nouvelle UI d'erreur inventée.
        <ErrorState message="Impossible de vérifier l'état du match." onRetry={() => refetchActiveCheckin()} />
      ) : !sessionId ? (
        <Text className="text-sm text-fg-muted">
          Passe le club en recrutement LIVE pour lancer un match — le check-in doit être rattaché à une session LIVE en cours.
        </Text>
      ) : (
        <Button
          icon={<PlayCircle size={16} color="#08090b" />}
          disabled={activeCheckinLoading}
          onPress={() => setStep("confirm")}
        >
          Prêt à lancer le match
        </Button>
      )}
    </Card>
  );
}
