import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ban, Flag, MessageCircle, Star } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ClubProCard } from "@/components/profile/ClubProCard";
import { LinkEaClubForm } from "@/components/profile/LinkEaClubForm";
import { ScoutReportPanel } from "@/components/profile/ScoutReportPanel";
import { ReviewForm } from "@/components/profile/ReviewForm";
import { useUserProfile, useUserReviews } from "@/lib/hooks/useProfile";
import { useStartDirectConversation } from "@/lib/hooks/useChat";
import { useBlockedUserIds, useBlockUser, useMyBlocks, useUnblockUser } from "@/lib/hooks/useSafety";
import { useAuth } from "@/lib/providers/AuthProvider";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/lib/toast";

/** Contenu de la page profil, réutilisé pour le profil perso (tab) et /profile/[id]. */
export function ProfileContent({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const { session } = useAuth();
  const { data: user, isLoading, isError, refetch } = useUserProfile(userId);
  const { data: reviews } = useUserReviews(userId);
  const startConversation = useStartDirectConversation();
  const { data: blockedIds } = useBlockedUserIds(session?.user.id ?? null);
  const { data: myBlocks } = useMyBlocks(session?.user.id ?? null);
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const iBlockedThem = Boolean(myBlocks?.some((row) => row.blocked_id === userId));
  const blockedEitherWay = Boolean(blockedIds?.includes(userId));

  if (isError) {
    return (
      <View className="w-full items-center">
        <ClubProCard error onRetry={refetch} />
      </View>
    );
  }

  if (isLoading || !user) {
    return (
      <View className="items-center gap-4">
        <ClubProCard loading />
        <Skeleton className="h-32 w-full" />
      </View>
    );
  }

  const avgSkill = reviews?.length ? reviews.reduce((s, r) => s + r.rating_skill, 0) / reviews.length : null;
  const avgBehavior = reviews?.length ? reviews.reduce((s, r) => s + r.rating_behavior, 0) / reviews.length : null;

  return (
    <View className="items-center gap-4">
      <ClubProCard
        data={{
          username: user.username,
          platform: user.platform,
          mainPosition: user.main_position,
          secondaryPositions: user.secondary_positions ?? [],
          plan: user.plan,
          eaIdentityKind: user.ea_identity_kind,
        }}
      />

      {!isOwn && (
        <View className="w-full gap-2">
          {!blockedEitherWay && (
            <Button
              variant="secondary"
              size="sm"
              icon={<MessageCircle size={15} color="#f4f5f7" />}
              loading={startConversation.isPending}
              onPress={() =>
                startConversation.mutate(user.id, {
                  onSuccess: (data) => router.push(`/conversation/${data.conversation.id}`),
                  onError: (err: any) => toast.error(err.message ?? "Impossible de démarrer la conversation."),
                })
              }
            >
              Message
            </Button>
          )}
          <View className="flex-row gap-2">
            <Button
              variant={iBlockedThem ? "secondary" : "danger"}
              size="sm"
              className="flex-1"
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
              size="sm"
              className="flex-1"
              icon={<Flag size={15} color="#9aa0a8" />}
              onPress={() => router.push(`/report/${user.id}`)}
            >
              Signaler
            </Button>
          </View>
        </View>
      )}

      {isOwn && !user.ea_club_linked && <LinkEaClubForm />}
      {isOwn && <ScoutReportPanel isPro={user.plan === "PRO"} />}

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

      {!isOwn && <ReviewForm targetUserId={user.id} />}
    </View>
  );
}
