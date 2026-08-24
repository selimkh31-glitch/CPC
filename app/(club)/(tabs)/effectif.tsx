import { useCallback } from "react";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { MembersPanel } from "@/components/club/MembersPanel";
import { DeparturesPanel } from "@/components/club/DeparturesPanel";
import { InviteToClubPanel } from "@/components/club/InviteToClubPanel";
import { LivePlayersRecruitPanel } from "@/components/club/LivePlayersRecruitPanel";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { findActiveLiveSession } from "@/lib/live";

/**
 * Effectif — Mode Club (Foundation #1). Regroupe MembersPanel (rôles,
 * "Retirer" — canManage réel, OWNER∨MANAGER, M1 préservé) et DeparturesPanel
 * (demandes de départ en cours) : les deux composants existants réutilisés
 * tels quels, aucune logique dupliquée. `canManage` recalculé ici à partir de
 * club.members réel — jamais dérivé de `mode` (le mode n'est pas une
 * permission, voir AppModeProvider).
 *
 * Foundation #2.3 — `ModeSwitch` ajouté (même composant que match.tsx, même
 * source `useMyMemberships`, déjà en cache la plupart du temps) : le retour
 * vers Mode Joueur doit être atteignable depuis n'importe quel tab Mode Club,
 * pas seulement Match.
 *
 * Invitations CLUB — `InviteToClubPanel` ajouté, gated `canManage` (action de
 * gestion, contrairement à DeparturesPanel/MembersPanel qui restent visibles
 * en lecture) : recherche + invitation de joueurs non-membres, indépendante
 * de toute feuille de match (voir supabase/functions/invite-to-club, distinct
 * d'invite-to-slot).
 *
 * Fix (audit "cache club.members obsolète côté manager") — `["club", clubId]`
 * (lib/hooks/useClubs.ts > useClub, source de `club.members`) n'a aucun
 * canal realtime ni invalidation croisée : quand un joueur rejoint le club
 * en acceptant une invitation MATCH sur SON appareil (`respond-invitation`,
 * jamais touchée ici), rien ne prévient ce query côté manager. `useFocusEffect`
 * (expo-router, primitive déjà installée pour cette stack — pas de nouveau
 * système) rafraîchit `club.members` à chaque retour sur l'onglet Effectif :
 * mécanisme React Query standard (`refetch()`, déjà utilisé partout dans ce
 * fichier pour `onRetry`), pas de state parallèle.
 */
export default function EffectifTab() {
  const { session } = useAuth();
  const now = useLiveClock();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (isLoading || !club) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {isError ? <ErrorState message="Impossible de charger ce club." onRetry={refetch} /> : <Skeleton className="h-40" />}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const myMembership = session ? club.members?.find((m) => m.user_id === session.user.id) : undefined;
  const canManage = myMembership?.role === "OWNER" || myMembership?.role === "MANAGER";
  const clubLive = findActiveLiveSession(club.sessions, now);
  const owner = club.members?.find((m) => m.user_id === club.owner_id);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
        <ModeSwitch managedClubs={managedClubs} />
        <Text className="font-display text-2xl text-fg">Effectif</Text>
        <DeparturesPanel clubId={club.id} members={club.members ?? []} />
        <MembersPanel
          clubId={club.id}
          isOwner={club.owner_id === session?.user.id}
          canManage={canManage}
          members={club.members ?? []}
        />
        {canManage && (
          <LivePlayersRecruitPanel
            clubId={club.id}
            members={club.members ?? []}
            neededPositions={clubLive?.needed_positions ?? []}
            platform={owner?.user?.platform ?? null}
            clubLive={clubLive}
          />
        )}
        {canManage && <InviteToClubPanel clubId={club.id} members={club.members ?? []} />}
      </ScrollView>
    </SafeAreaView>
  );
}
