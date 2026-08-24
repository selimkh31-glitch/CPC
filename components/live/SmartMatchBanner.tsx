import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLiveSessions } from "@/lib/hooks/useLiveSessions";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useAuth } from "@/lib/providers/AuthProvider";
import { rankLiveClubsForPlayer } from "@/lib/liveMatch";
import { isLiveActive } from "@/lib/live";

/**
 * Reco LIVE déterministe (poste + plateforme + expiry + besoin club).
 * Pas d'IA, pas d'égalité username EA.
 */
export function SmartMatchBanner() {
  const { profile } = useAuth();
  const { data: sessions, isLoading } = useLiveSessions();
  const now = useLiveClock();

  if (isLoading) return <Skeleton className="h-24 mb-4" />;
  if (!profile) return null;

  const clubs = (sessions ?? [])
    .filter((s) => s.club && isLiveActive(s, now))
    .map((s) => ({
      clubId: s.club!.id,
      sessionId: s.id,
      neededPositions: s.needed_positions ?? [],
      platform: s.club?.owner?.platform ?? null,
      is_live: s.is_live,
      expires_at: s.expires_at,
    }));

  const matches = rankLiveClubsForPlayer(
    {
      mainPosition: profile.main_position,
      secondaryPositions: profile.secondary_positions ?? [],
      platform: profile.platform,
    },
    clubs,
    now
  ).slice(0, 3);

  if (matches.length === 0) return null;

  const nameBySession = new Map((sessions ?? []).map((s) => [s.id, s.club?.name ?? "Club"]));

  return (
    <View className="mb-4 rounded-2xl border border-accent/30 bg-accent/10 p-4">
      <View className="mb-2 flex-row items-center gap-1.5">
        <Sparkles size={15} color="#39ff8a" />
        <Text className="text-xs font-extrabold uppercase tracking-wide text-accent">
          Compatible avec ton LIVE
        </Text>
      </View>
      <View className="gap-1.5">
        {matches.map((m) => (
          <Pressable
            key={m.sessionId}
            onPress={() => router.push(`/club/${m.clubId}?session=${m.sessionId}`)}
            className="flex-row items-center justify-between"
          >
            <View className="flex-1 pr-2">
              <Text numberOfLines={1} className="text-sm font-bold text-fg">
                {nameBySession.get(m.sessionId) ?? "Club"}
              </Text>
              <Text numberOfLines={1} className="text-xs text-fg-muted">
                {m.reason}
              </Text>
            </View>
            <Text className="ml-2 text-sm font-extrabold text-accent">{m.score}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
