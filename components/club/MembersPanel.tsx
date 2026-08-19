import { Alert, Text, View } from "react-native";
import { Users } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useUpdateMember } from "@/lib/hooks/useClubs";
import { useReleaseMember } from "@/lib/hooks/useDepartures";
import { toast } from "@/lib/toast";
import type { ClubMemberRow } from "@/lib/types";

/**
 * Gestion des membres et rôles (section 3.B). Promotion/rétrogradation
 * MEMBER<->MANAGER reste owner only (RLS club_members_write_owner,
 * 0002_rls_policies.sql, n'autorise que owner_id = auth.uid() en écriture
 * directe sur club_members). "Retirer" est owner ET manager (release-member,
 * backend release_member_by_manager autorise OWNER ou MANAGER) — `canManage`
 * doit refléter ça, jamais recalculé ici.
 * Phase 5 : "Retirer" ne fait PLUS de delete direct sur club_members — passe
 * exclusivement par release-member (Edge Function), qui supprime aussi
 * slot_assignments côté serveur, historise l'événement (club_departures,
 * OWNER_RELEASED) et notifie le joueur. Jamais silencieux (confirmation
 * explicite avant l'appel).
 */
export function MembersPanel({
  clubId,
  members,
  isOwner,
  canManage,
}: {
  clubId: string;
  members: ClubMemberRow[];
  isOwner: boolean;
  canManage: boolean;
}) {
  const mutation = useUpdateMember(clubId);
  const release = useReleaseMember(clubId);

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
        <CardTitle icon={<Users size={18} color="#f4f5f7" />}>Membres</CardTitle>
        <Text className="text-sm text-fg-muted">{members.length}</Text>
      </CardHeader>
      <View className="gap-2">
        {members.map((m) => (
          <View key={m.user_id} className="flex-row items-center justify-between rounded-xl border border-border bg-bg-elevated p-2.5">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold text-fg">{m.user?.username}</Text>
              <Badge tone={m.role === "OWNER" ? "pro" : m.role === "MANAGER" ? "accent" : "neutral"}>{m.role}</Badge>
            </View>
            {(isOwner || canManage) && m.role !== "OWNER" && (
              <View className="flex-row gap-1.5">
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
            )}
          </View>
        ))}
      </View>
    </Card>
  );
}
