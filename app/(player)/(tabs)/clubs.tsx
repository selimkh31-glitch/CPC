import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Plus, Users } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PulseDot } from "@/components/ui/PulseDot";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { ClubHome } from "@/components/club/ClubHome";
import { ClubMatchmaking } from "@/components/club/ClubMatchmaking";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { CLUB_LEVEL_LABELS, LANGUAGE_LABELS } from "@/lib/constants";
import { useClubsList, useMyMemberships } from "@/lib/hooks/useClubs";
import { useMyDepartureUpdates } from "@/lib/hooks/useDepartures";
import { useAuth } from "@/lib/providers/AuthProvider";

/**
 * Onglet Club — Mode Joueur (Foundation #1, déplacé depuis app/(tabs)/clubs.tsx).
 *
 * Changement de philosophie par rapport à l'ancienne version : cet écran ne
 * bascule PLUS jamais automatiquement vers la gestion (plus de
 * `redirectHref`/`router.replace` vers /dashboard, plus de sélecteur
 * "managedClubs.length > 1" ici). Il reste TOUJOURS un écran Mode Joueur pur :
 *   - playerMembership existe -> ClubHome (lecture, "Mon Club").
 *   - sinon -> matchmaking + annuaire (inchangé).
 * La bascule vers la gestion passe désormais EXCLUSIVEMENT par le switch
 * explicite (ModeSwitch, visible dès managedClubs.length > 0) — c'est
 * app/(club)/_layout.tsx qui gère ensuite la sélection du club géré (1 club :
 * direct : plusieurs : sélecteur explicite, jamais un `[0]` implicite).
 *
 *   playerMembership = memberships.find(role MEMBER ou MANAGER)
 *     -> 0 ou 1 max, garanti par club_members_one_active_role_per_user.
 *   managedClubs = memberships.filter(role OWNER ou MANAGER)
 *     -> 0..N, uniquement pour décider si le switch est visible.
 */
export default function ClubsScreen() {
  const { session } = useAuth();
  const { data: memberships, isLoading: membershipsLoading } = useMyMemberships(session?.user.id ?? null);
  const [directoryTab, setDirectoryTab] = useState<"matchmaking" | "directory">("matchmaking");

  // Réagit en temps réel si le joueur perd son club depuis un autre appareil
  // (N1, inchangé) : invalide my-memberships pour que cet écran retombe sur
  // le matchmaking sans attendre remount/refetch naturel.
  const onDepartureChange = useCallback(() => {}, []);
  useMyDepartureUpdates(session?.user.id ?? null, onDepartureChange);

  const playerMembership = memberships?.find((m) => m.role === "MEMBER" || m.role === "MANAGER") ?? null;
  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];

  if (membershipsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton className="h-40" />
        </View>
      </SafeAreaView>
    );
  }

  // Club joueur — ClubHome rendu directement dans l'onglet (N2 : la bottom
  // tab bar reste visible, aucune navigation).
  if (playerMembership) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        {managedClubs.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <ModeSwitch managedClubs={managedClubs} />
          </View>
        )}
        <ClubHome clubId={playerMembership.club.id} />
      </SafeAreaView>
    );
  }

  // Aucun club joueur — matchmaking promu, annuaire complet en vue
  // secondaire (inchangé). Le switch reste visible ici pour un OWNER sans
  // playerMembership (voir vision cible, audit architecture).
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="gap-2 px-4 pt-2">
        {managedClubs.length > 0 && <ModeSwitch managedClubs={managedClubs} />}
        <View className="flex-row items-center justify-between">
          <View className="flex-row rounded-2xl border border-border bg-bg-elevated p-1">
            <Pressable
              onPress={() => setDirectoryTab("matchmaking")}
              className={`rounded-xl px-3 py-2 ${directoryTab === "matchmaking" ? "bg-accent" : ""}`}
            >
              <Text className={`text-sm font-bold ${directoryTab === "matchmaking" ? "text-bg" : "text-fg-muted"}`}>Pour toi</Text>
            </Pressable>
            <Pressable
              onPress={() => setDirectoryTab("directory")}
              className={`rounded-xl px-3 py-2 ${directoryTab === "directory" ? "bg-accent" : ""}`}
            >
              <Text className={`text-sm font-bold ${directoryTab === "directory" ? "text-bg" : "text-fg-muted"}`}>Tous les clubs</Text>
            </Pressable>
          </View>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus size={16} color="#f4f5f7" />}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/create-club");
            }}
          >
            Créer
          </Button>
        </View>
      </View>

      {directoryTab === "matchmaking" ? <ClubMatchmaking /> : <ClubsDirectory />}
    </SafeAreaView>
  );
}

/** Annuaire complet (préexistant, inchangé) — vue secondaire de l'onglet Club. */
function ClubsDirectory() {
  const { data: clubs, isLoading, isError, refetch, isRefetching } = useClubsList();

  return (
    <FlatList
      data={clubs}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#39ff8a" />}
      ListHeaderComponent={
        <View className="mb-2 flex-row items-center gap-2">
          <Users size={20} color="#39ff8a" />
          <Text className="font-display text-xl text-fg">Tous les clubs</Text>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <View className="gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message="Impossible de charger les clubs." onRetry={refetch} />
        ) : (
          <EmptyState title="Aucun club pour l'instant." subtitle="Sois le premier à en créer un." />
        )
      }
      renderItem={({ item: club }) => {
        const isLive = club.sessions?.some((s) => s.is_live);
        return (
          <Pressable onPress={() => router.push(`/club/${club.id}`)} className="active:opacity-90">
            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="font-display text-lg text-fg">{club.name}</Text>
                {isLive && <PulseDot />}
              </View>
              <Badge tone={club.level === "COMPETITIVE" ? "accent" : "neutral"} className="mt-1.5">
                {CLUB_LEVEL_LABELS[club.level]}
              </Badge>
              {club.description && (
                <Text numberOfLines={2} className="mt-2 text-sm text-fg-muted">
                  {club.description}
                </Text>
              )}
              <Text className="mt-2 text-xs text-fg-subtle">
                {club.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")}
              </Text>
            </Card>
          </Pressable>
        );
      }}
      ItemSeparatorComponent={() => <View className="h-3" />}
    />
  );
}
