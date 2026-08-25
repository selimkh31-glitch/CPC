import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ban, Flag, Star, UserMinus } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ClubProCard } from "@/components/profile/ClubProCard";
import { LinkEaClubForm } from "@/components/profile/LinkEaClubForm";
import { ScoutReportPanel } from "@/components/profile/ScoutReportPanel";
import { ReviewForm } from "@/components/profile/ReviewForm";
import { StartDirectMessageButton } from "@/components/social/StartDirectMessageButton";
import { useUserProfile, useUserReviews } from "@/lib/hooks/useProfile";
import { usePlayerMatchHistory } from "@/lib/hooks/useMatchHistory";
import { useCurrentClubForUser } from "@/lib/hooks/useCurrentClubs";
import { useClub, useClearSlotAssignment } from "@/lib/hooks/useClubs";
import { useBlockedUserIds, useBlockUser, useMyBlocks, useUnblockUser } from "@/lib/hooks/useSafety";
import { shouldHideContactCta } from "@/lib/safety";
import { PLAYER_CARD_COPY } from "@/lib/playerCard";
import { canMutateClub } from "@/lib/sessionState";
import { useAuth } from "@/lib/providers/AuthProvider";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/lib/toast";

/** Contenu de la page profil, réutilisé pour le profil perso (tab) et /profile/[id]. */
export function ProfileContent({
  userId,
  isOwn,
  clubId = null,
}: {
  userId: string;
  isOwn: boolean;
  /** Club de la feuille d'où on vient — manager : Retirer de la feuille. */
  clubId?: string | null;
}) {
  const { session } = useAuth();
  const { data: user, isLoading, isError, refetch } = useUserProfile(userId);
  const { data: reviews } = useUserReviews(userId);
  const {
    data: matchHistory,
    isLoading: matchHistoryLoading,
    isError: matchHistoryError,
    refetch: refetchMatchHistory,
  } = usePlayerMatchHistory(userId);
  const currentClub = useCurrentClubForUser(userId);
  const { data: blockedIds } = useBlockedUserIds(session?.user.id ?? null);
  const { data: myBlocks } = useMyBlocks(session?.user.id ?? null);
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const iBlockedThem = Boolean(myBlocks?.some((row) => row.blocked_id === userId));
  const blockedEitherWay = shouldHideContactCta(userId, blockedIds);
  const [eaSheetOpen, setEaSheetOpen] = useState(false);

  if (isError) {
    return (
      <View className="w-full items-center">
        <ClubProCard error onRetry={refetch} />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="items-center gap-4">
        <ClubProCard loading />
      </View>
    );
  }

  const avgSkill = reviews?.length ? reviews.reduce((s, r) => s + r.rating_skill, 0) / reviews.length : null;
  const avgBehavior = reviews?.length ? reviews.reduce((s, r) => s + r.rating_behavior, 0) / reviews.length : null;

  return (
    <View className="items-center gap-6">
      <ClubProCard
        user={user}
        clubName={currentClub.data?.name ?? null}
        clubId={currentClub.data?.id ?? null}
        cpcMatchesPlayed={matchHistory?.played ?? null}
        matchHistory={matchHistory?.items}
        matchHistoryLoading={matchHistoryLoading}
        matchHistoryError={matchHistoryError}
        onRetryMatchHistory={refetchMatchHistory}
        onLinkEaClub={isOwn && user && !user.ea_club_linked ? () => setEaSheetOpen(true) : undefined}
      />

      {isOwn && user && (
        <Sheet visible={eaSheetOpen} onClose={() => setEaSheetOpen(false)} title={PLAYER_CARD_COPY.linkClub}>
          <LinkEaClubForm embedded onLinked={() => setEaSheetOpen(false)} />
        </Sheet>
      )}

      {isOwn && user && (
        <Pressable
          onPress={() => router.push("/edit-profile")}
          className="min-h-[44px] self-start justify-center"
          accessibilityRole="button"
          accessibilityLabel="Modifier le profil"
        >
          <Text className="text-sm text-fg-subtle">Modifier le profil</Text>
        </Pressable>
      )}

      {!isOwn && user && (
        <View className="w-full gap-2">
          <StartDirectMessageButton otherUserId={user.id} blocked={blockedEitherWay} />
          <View className="flex-row gap-2">
            <Button
              variant={iBlockedThem ? "secondary" : "danger"}
              className="min-h-[44px] flex-1"
              icon={<Ban size={15} color={iBlockedThem ? "#f4f5f7" : "#ff5c7a"} />}
              loading={blockUser.isPending || unblockUser.isPending}
              onPress={() => {
                if (iBlockedThem) {
                  unblockUser.mutate(user.id, {
                    onSuccess: () => toast.success("Joueur débloqué."),
                    onError: (err: any) => toast.error(err.message ?? "Impossible de débloquer."),
                  });
                } else {
                  blockUser.mutate(user.id, {
                    onSuccess: () => toast.success("Joueur bloqué — il disparaît du LIVE, du matching et des messages."),
                    onError: (err: any) => toast.error(err.message ?? "Impossible de bloquer."),
                  });
                }
              }}
            >
              {iBlockedThem ? "Débloquer" : "Bloquer"}
            </Button>
            <Button
              variant="ghost"
              className="min-h-[44px] flex-1"
              icon={<Flag size={15} color="#9aa0a8" />}
              onPress={() => router.push(`/report/${user.id}`)}
            >
              Signaler
            </Button>
          </View>
          {clubId ? <RemoveFromSheetButton clubId={clubId} userId={user.id} /> : null}
        </View>
      )}

      {isOwn && user && <ScoutReportPanel isPro={user.plan === "PRO"} />}

      <Card className="w-full">
        <Text className="mb-3 font-display text-lg text-fg">Reviews reçues</Text>
        {avgSkill !== null ? (
          <View className="mb-3 flex-row gap-6">
            <View>
              <Text className="text-xs text-fg-muted">Skill moyen</Text>
              <View className="flex-row items-center gap-1">
                <Star size={14} color="#39ff8a" fill="#39ff8a" />
                <Text className="font-extrabold text-fg">{avgSkill.toFixed(1)}</Text>
              </View>
            </View>
            <View>
              <Text className="text-xs text-fg-muted">Comportement moyen</Text>
              <View className="flex-row items-center gap-1">
                <Star size={14} color="#39ff8a" fill="#39ff8a" />
                <Text className="font-extrabold text-fg">{avgBehavior?.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <Text className="mb-3 text-sm text-fg-muted">Pas encore de reviews.</Text>
        )}

        <View className="gap-2">
          {(reviews ?? []).map((r) => (
            <View key={r.id} className="rounded-xl border border-border bg-bg-elevated p-3">
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-fg">{r.reviewer?.username}</Text>
                <Text className="text-xs text-fg-subtle">{timeAgo(r.created_at)}</Text>
              </View>
              {r.comment && <Text className="mt-1 text-sm text-fg-muted">{r.comment}</Text>}
            </View>
          ))}
        </View>
      </Card>

      {!isOwn && user && <ReviewForm targetUserId={user.id} />}
    </View>
  );
}

function RemoveFromSheetButton({ clubId, userId }: { clubId: string; userId: string }) {
  const { session } = useAuth();
  const { data: club } = useClub(clubId);
  const clear = useClearSlotAssignment(clubId);
  const myMembership = session ? club?.members?.find((m) => m.user_id === session.user.id) : undefined;
  const onSheet = Boolean(club?.slotAssignments?.some((row) => row.user_id === userId));
  if (!canMutateClub(myMembership?.role) || session?.user.id === userId || !onSheet) return null;

  return (
    <Button
      variant="secondary"
      className="min-h-[44px]"
      icon={<UserMinus size={15} color="#f4f5f7" />}
      loading={clear.isPending}
      onPress={() =>
        clear.mutate(userId, {
          onSuccess: () => {
            toast.success("Retiré de la feuille.");
            if (router.canGoBack()) router.back();
          },
          onError: (err: any) => toast.error(err.message ?? "Impossible de retirer de la feuille."),
        })
      }
    >
      Retirer de la feuille
    </Button>
  );
}
