import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Radio } from "lucide-react-native";
import { LivePlayerCard } from "@/components/live/LivePlayerCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLivePlayers } from "@/lib/hooks/usePlayerLive";
import { useClubInvitations, useInvitePlayerToClub } from "@/lib/hooks/useInvitations";
import { toast } from "@/lib/toast";
import { isLiveActive } from "@/lib/live";
import { isPlayerCompatibleWithClubNeed } from "@/lib/liveMatch";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import type { ClubMemberRow } from "@/lib/types";
import type { LiveSessionLike } from "@/lib/live";

/**
 * Mode Club — joueurs LIVE compatibles (poste + plateforme + expiry + besoin).
 */
export function LivePlayersRecruitPanel({
  clubId,
  members,
  neededPositions,
  platform,
  clubLive,
}: {
  clubId: string;
  members: ClubMemberRow[];
  neededPositions: string[];
  platform: string | null;
  clubLive: LiveSessionLike | null;
}) {
  const now = useLiveClock();
  const { data: livePlayers, isLoading } = useLivePlayers();
  const { data: invitations } = useClubInvitations(clubId);
  const invite = useInvitePlayerToClub();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  const pendingInviteIds = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invitations ?? []) {
      if (inv.slot_id === null && inv.status === "PENDING") set.add(inv.user_id);
    }
    return set;
  }, [invitations]);

  const clubIsLive = isLiveActive(clubLive, now);
  const candidates = (livePlayers ?? []).filter((row) => {
    if (!isLiveActive(row, now) || !row.user || memberIds.has(row.user_id)) return false;
    if (!clubIsLive || !clubLive) return false;
    return isPlayerCompatibleWithClubNeed(
      {
        mainPosition: row.user.main_position,
        secondaryPositions: row.user.secondary_positions ?? [],
        platform: row.user.platform,
      },
      {
        neededPositions,
        platform,
        is_live: clubLive.is_live,
        expires_at: clubLive.expires_at,
      },
      now
    );
  });

  const act = (userId: string) => {
    setPendingUserId(userId);
    invite.mutate(
      { clubId, userId },
      {
        onSuccess: () => toast.success("Invitation envoyée."),
        onError: (err: any) => toast.error(err.message ?? "Impossible d'inviter."),
        onSettled: () => setPendingUserId(null),
      }
    );
  };

  return (
    <View>
      <View className="mb-2 flex-row items-center gap-2">
        <Radio size={16} color="#39ff8a" />
        <Text className="font-display text-lg text-fg">Joueurs LIVE</Text>
        <Text className="ml-auto text-xs text-fg-muted">{candidates.length}</Text>
      </View>
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : candidates.length === 0 ? (
        <Text className="text-sm text-fg-muted">
          {clubIsLive ? "Aucun joueur LIVE compatible (poste + plateforme)." : "Passe le club en LIVE pour voir les joueurs compatibles."}
        </Text>
      ) : (
        <View className="gap-3">
          {candidates.map((item) => {
            const already = pendingInviteIds.has(item.user_id);
            return (
              <LivePlayerCard
                key={item.id}
                item={item}
                inviting={pendingUserId === item.user_id}
                inviteLabel={already ? "Déjà invité" : "Inviter au club"}
                onInvite={already ? undefined : () => act(item.user_id)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
