import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Globe2, Users } from "lucide-react-native";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PulseDot } from "@/components/ui/PulseDot";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { FormationPitch } from "@/components/club/FormationPitch";
import { MyDepartureStatusCard } from "@/components/club/MyDepartureStatusCard";
import { VoiceLinkBlock } from "@/components/club/VoiceLinkBlock";
import { useClub } from "@/lib/hooks/useClubs";
import { useApply } from "@/lib/hooks/useApply";
import { useAuth } from "@/lib/providers/AuthProvider";
import { CLUB_LEVEL_LABELS, LANGUAGE_LABELS, POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { findActiveLiveSession } from "@/lib/live";
import type { FormationId, FormationSlot } from "@/lib/formations";

/**
 * "Mon Club" — Foundation #1 : ClubHome est désormais EXCLUSIVEMENT la vue
 * Mode Joueur d'un club (lecture) — plus aucune branche `canManage` ne le
 * transforme en dashboard. La gestion (formation éditable, recrutement,
 * check-in) vit maintenant dans l'arbre Mode Club (app/(club)/(tabs)/...),
 * qui réutilise FormationPitch/FormationSelector/MatchCheckinPanel
 * indépendamment de ce composant. Consommé par deux écrans :
 *   - app/(player)/(tabs)/clubs.tsx (cas playerMembership) : rendu
 *     directement dans l'onglet, SANS navigation — la bottom tab bar reste
 *     visible (voir audit navigation N2).
 *   - app/match-sheet.tsx : wrapper fin conservant le header natif/retour,
 *     pour les entrées externes (page publique d'un club, raccourci "Mes
 *     clubs" du profil pour une ligne MEMBER/MANAGER).
 * Le switch vers Mode Club (pour OWNER/MANAGER) vit dans l'écran appelant
 * (ModeSwitch, à côté de ClubHome) — jamais dans ce composant lui-même, pour
 * qu'il reste une vue joueur pure quel que soit le club affiché (y compris un
 * club où le viewer n'est ni membre ni gestionnaire).
 */
export function ClubHome({ clubId }: { clubId: string | null }) {
  const { session } = useAuth();
  const { data: club, isLoading, isError, refetch } = useClub(clubId);
  const apply = useApply();

  if (isError) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <ErrorState message="Impossible de charger la feuille de match." onRetry={refetch} />
      </ScrollView>
    );
  }

  if (isLoading || !club) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Skeleton className="h-[420px]" />
      </ScrollView>
    );
  }

  const myMembership = session ? club.members?.find((m) => m.user_id === session.user.id) : undefined;
  const isMember = Boolean(myMembership);
  const formationId = (club.formation as FormationId | null) ?? null;
  const assignments = club.slotAssignments ?? [];
  const activeSession = findActiveLiveSession(club.sessions, Date.now());
  // Banc — tout membre sans slot_assignment, dérivé de l'existant : aucune
  // nouvelle table/requête, réutilise club_members + slot_assignments.
  const startingUserIds = new Set(assignments.map((a) => a.user_id));
  const bench = (club.members ?? []).filter((m) => !startingUserIds.has(m.user_id));
  const owner = club.members?.find((m) => m.role === "OWNER");
  const managers = (club.members ?? []).filter((m) => m.role === "MANAGER");

  // Foundation #1 — ClubHome est une vue joueur pure : un slot vide n'ouvre
  // plus jamais le recrutement ici (canManage n'existe plus dans ce
  // composant), même pour un OWNER/MANAGER qui consulterait son propre club
  // en Mode Joueur. Le recrutement vit désormais exclusivement dans
  // app/(club)/(tabs)/match.tsx. Un membre (donc aussi un MANAGER, qui
  // reste isMember=true sur ce même club) tombe simplement sur "Poste
  // vacant." — jamais un clic silencieux, comportement inchangé pour ce cas.
  const onEmptySlotPress = (slot: FormationSlot) => {
    if (!session) {
      toast.info("Connecte-toi pour postuler.");
      return;
    }
    if (isMember) {
      toast.info("Poste vacant.");
      return;
    }
    if (!activeSession) {
      toast.info("Ce club n'est pas en live actuellement — la candidature n'est possible que pendant une session live.");
      return;
    }
    const positionLabel = POSITION_LABELS[slot.position as PositionCode] ?? slot.position;
    Alert.alert(`Postuler au poste ${positionLabel} ?`, undefined, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Postuler",
        onPress: () =>
          apply.mutate(
            { sessionId: activeSession.id, position: slot.position, slotId: slot.slotId },
            {
              onSuccess: () => toast.success("Candidature envoyée !"),
              onError: (err: any) => toast.error(err.message ?? "Erreur"),
            }
          ),
      },
    ]);
  };

  const goToProfile = (userId: string) => {
    Haptics.selectionAsync();
    router.push(`/profile/${userId}`);
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
      {/* 1. Header club */}
      <View>
        <Text className="font-display text-2xl text-fg">{club.name}</Text>
        <View className="mt-1 flex-row flex-wrap items-center gap-2">
          <Badge tone={club.level === "COMPETITIVE" ? "accent" : "neutral"}>{CLUB_LEVEL_LABELS[club.level]}</Badge>
          <View className="flex-row items-center gap-1">
            <Globe2 size={12} color="#666c74" />
            <Text className="text-xs text-fg-subtle">{club.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")}</Text>
          </View>
        </View>
        {club.description && <Text className="mt-2 text-sm text-fg-muted">{club.description}</Text>}
        {owner?.user?.username && (
          <Text numberOfLines={1} className="mt-2 text-xs text-fg-subtle">
            Owner : {owner.user.username}
            {managers.length > 0 ? ` · Manager : ${managers.map((m) => m.user?.username).join(", ")}` : ""}
          </Text>
        )}
      </View>

      {/* 2. État du club — sections à plat, enfants directs du ScrollView
          (même profondeur qu'avant l'extraction de ClubHome : VoiceLinkBlock
          n'est imbriqué dans aucun wrapper intermédiaire). Postes recherchés/
          note : mêmes données que club/[id].tsx (club_sessions.needed_positions/
          note), simple lecture, aucun nouveau moteur de matching. */}
      <Card>
        <Text className="mb-2 font-display text-lg text-fg">Session</Text>
        {activeSession ? (
          <>
            <View className="mb-3 flex-row items-center gap-1.5">
              <PulseDot />
              <Text className="text-xs font-extrabold text-accent">LIVE</Text>
            </View>
            {activeSession.needed_positions.length > 0 && (
              <View className="mb-3">
                <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-fg-muted">Postes recherchés</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {activeSession.needed_positions.map((p) => (
                    <Badge key={p} tone="pro">
                      {POSITION_LABELS[p] ?? p}
                    </Badge>
                  ))}
                </View>
              </View>
            )}
            {activeSession.note && <Text className="text-sm text-fg-muted">{activeSession.note}</Text>}
          </>
        ) : (
          <Text className="text-xs text-fg-subtle">Club hors ligne actuellement — aucune recherche active.</Text>
        )}
      </Card>

      <VoiceLinkBlock voiceLink={club.voice_link} />

      {/* 3. Formation — lecture seule ici (Foundation #1) ; l'édition
          (FormationSelector) vit dans app/(club)/(tabs)/match.tsx. */}
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-lg text-fg">Formation</Text>
        {formationId && <Text className="font-display text-base text-fg-muted">{formationId}</Text>}
      </View>

      {formationId ? (
        <FormationPitch
          formationId={formationId}
          assignments={assignments}
          onEmptySlotPress={onEmptySlotPress}
          currentUserId={session?.user.id ?? null}
          // Foundation #2.1 — Mode Joueur : jamais d'affordance de
          // recrutement. `interactive={false}` supprime le "+"/l'indice
          // "Rechercher" sur les slots vides (voir FormationPitch/PitchSlot) ;
          // le tap sur un titulaire (-> profil) reste inchangé, ce prop ne
          // désactive que la partie "slot vide" du composant.
          interactive={false}
        />
      ) : (
        <EmptyState title="Ce club n'a pas encore configuré sa formation." />
      )}

      {/* 4. Effectif / banc */}
      {bench.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle icon={<Users size={18} color="#f4f5f7" />}>Banc</CardTitle>
            <Text className="text-sm text-fg-muted">{bench.length}</Text>
          </CardHeader>
          <View className="gap-1.5">
            {bench.map((m) => (
              <Pressable key={m.user_id} onPress={() => goToProfile(m.user_id)} className="active:opacity-70">
                <Text numberOfLines={1} className="text-sm text-fg">
                  {m.user?.username ?? "Joueur"}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {/* 5. Mon statut — engagement/départ, MEMBER et MANAGER (jamais OWNER, section 9).
          Le check-in (MatchCheckinPanel) n'est plus ici — Foundation #1, vit
          désormais dans app/(club)/(tabs)/match.tsx (owner/manager only). */}
      {myMembership && myMembership.role !== "OWNER" && session && (
        <MyDepartureStatusCard clubId={club.id} userId={session.user.id} membership={myMembership} />
      )}
    </ScrollView>
  );
}
