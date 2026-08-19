import { Text, View } from "react-native";
import { router } from "expo-router";
import { MessageCircle, Star } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { ClubProCard } from "@/components/profile/ClubProCard";
import { LinkEaClubForm } from "@/components/profile/LinkEaClubForm";
import { ScoutReportPanel } from "@/components/profile/ScoutReportPanel";
import { ReviewForm } from "@/components/profile/ReviewForm";
import { useUserProfile, useUserReviews } from "@/lib/hooks/useProfile";
import { useStartDirectConversation } from "@/lib/hooks/useChat";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/lib/toast";

/** Contenu de la page profil, réutilisé pour le profil perso (tab) et /profile/[id]. */
export function ProfileContent({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const { data: user, isLoading, isError, refetch } = useUserProfile(userId);
  const { data: reviews } = useUserReviews(userId);
  const startConversation = useStartDirectConversation();

  if (isError) {
    return (
      <View className="w-full">
        <ErrorState message="Impossible de charger ce profil." onRetry={refetch} />
      </View>
    );
  }

  if (isLoading || !user) {
    return (
      <View className="items-center gap-4">
        <Skeleton className="h-72 w-full max-w-sm" />
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
          playStyle: user.play_style,
          reliabilityScore: user.reliability_score,
          plan: user.plan,
          currentStreak: user.current_streak,
          verifiedStats: user.verified_stats,
          eaClubLinked: user.ea_club_linked,
        }}
      />

      {!isOwn && (
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
