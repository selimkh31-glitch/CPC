import { Alert, Text, View } from "react-native";
import { Users } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlayerCard } from "@/components/player/PlayerCard";
import { StartDirectMessageButton } from "@/components/social/StartDirectMessageButton";
import { buildPlayerCardData } from "@/lib/playerCard";
import { sortClubRoster } from "@/lib/clubProfile";
import { useUpdateMember } from "@/lib/hooks/useClubs";
import { useReleaseMember } from "@/lib/hooks/useDepartures";
import { useBlockedUserIds } from "@/lib/hooks/useSafety";
import { shouldHideContactCta } from "@/lib/safety";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";
import type { ClubMemberRow, ClubRole } from "@/lib/types";

const ROLE_LABEL: Record<ClubRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  MEMBER: "Membre",
};

/**
 * Effectif réel (club_members). Promotion MEMBER<->MANAGER : owner only
 * (RLS club_members_write_owner). Retirer : owner ET manager via release-member.
 * Aucun changement de RLS ni de rôles — affichage uniquement via PlayerCard.
 */
export function MembersPanel({
  clubId,
  clubName,
  members,
  isOwner,
  canManage,
}: {
  clubId: string;
  clubName?: string;
  members: ClubMemberRow[];
  isOwner: boolean;
  canManage: boolean;
}) {
  const mutation = useUpdateMember(clubId);
  const release = useReleaseMember(clubId);
  const roster = sortClubRoster(members);
  const { session } = useAuth();
  const selfId = session?.user.id ?? null;
  const { data: blockedIds } = useBlockedUserIds(selfId);

  const updateRole = (userId: string, role: "MANAGER" | "MEMBER") =>
    mutation.mutate({ userId, role }, { onSuccess: () => toast.success("Rôle mis à jour."), onError: (e: any) => toast.error(e.message) });

  const confirmRelease = (userId: string, username: string) => {
    Alert.alert("Libérer ce joueur ?", `${username} sera immédiatement retiré du club et notifié.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Libérer",
        style: "destructive",
        onPress: () =>
          release.mutate(userId, {
            onSuccess: () => toast.success("Membre libéré."),
            onError: (e: any) => toast.error(e.message ?? "Erreur"),
          }),
      },
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Users size={18} color="#f4f5f7" />}>Effectif</CardTitle>
        <Text className="text-sm text-fg-muted">{members.length}</Text>
      </CardHeader>
      {roster.length === 0 ? (
        <Text className="text-sm text-fg-muted">Aucun membre dans ce club pour l&apos;instant.</Text>
      ) : (
        <View className="gap-2">
          {roster.map((m) => {
            const showDm = Boolean(m.user && selfId && m.user_id !== selfId);
            const manage =
              (isOwner || canManage) && m.role !== "OWNER" ? (
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  {isOwner &&
                    (m.role === "MEMBER" ? (
                      <Button size="sm" variant="secondary" onPress={() => updateRole(m.user_id, "MANAGER")}>
                        Promouvoir
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onPress={() => updateRole(m.user_id, "MEMBER")}>
                        Rétrograder
                      </Button>
                    ))}
                  {canManage && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={release.isPending}
                      onPress={() => confirmRelease(m.user_id, m.user?.username ?? "ce joueur")}
                    >
                      Retirer
                    </Button>
                  )}
                </View>
              ) : null;

            if (!m.user) {
              return (
                <View key={m.user_id} className="border border-border bg-bg-elevated p-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold text-fg-muted">Joueur</Text>
                    <Badge tone={m.role === "OWNER" ? "pro" : m.role === "MANAGER" ? "accent" : "neutral"}>
                      {ROLE_LABEL[m.role]}
                    </Badge>
                  </View>
                  {manage}
                </View>
              );
            }

            return (
              <PlayerCard
                key={m.user_id}
                data={buildPlayerCardData(m.user, { clubName: clubName ?? null })}
                variant="mini"
                footer={
                  <View className="mt-2 gap-2">
                    <Badge tone={m.role === "OWNER" ? "pro" : m.role === "MANAGER" ? "accent" : "neutral"}>
                      {ROLE_LABEL[m.role]}
                    </Badge>
                    {showDm ? (
                      <StartDirectMessageButton
                        otherUserId={m.user_id}
                        blocked={shouldHideContactCta(m.user_id, blockedIds)}
                      />
                    ) : null}
                    {manage}
                  </View>
                }
              />
            );
          })}
        </View>
      )}
    </Card>
  );
}
