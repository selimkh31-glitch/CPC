import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLiveSessions } from "@/lib/hooks/useLiveSessions";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { useAuth } from "@/lib/providers/AuthProvider";
import { rankLiveClubsForPlayer } from "@/lib/liveMatch";
import { isLiveActive } from "@/lib/live";

/**
 * Reco LIVE déterministe (poste + plateforme + expiry + besoin club).
 * Affiche le motif réel — jamais un score / % de compatibilité.
 */
export function SmartMatchBanner({ visible = true }: { visible?: boolean }) {
  const { profile } = useAuth();
  const { data: sessions, isLoading } = useLiveSessions();
  const now = useLiveClock();

  if (!visible) return null;
  if (isLoading) return <Skeleton className="mb-3 h-14" />;
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
  );

  if (matches.length === 0) return null;

  const sampleReason = matches[0]?.reason;

  return (
    <View className="mb-3 flex-row items-start gap-2 rounded-xl bg-accent/10 px-3 py-2.5">
      <Sparkles size={14} color="#39ff8a" />
      <View className="min-w-0 flex-1">
        <Text className="text-xs font-bold text-accent">
          {matches.length} club{matches.length > 1 ? "s" : ""} correspondent à ton profil
        </Text>
        <Text numberOfLines={2} className="mt-0.5 text-[11px] text-fg-muted">
          {sampleReason || "Poste recherché · même plateforme"}
        </Text>
      </View>
    </View>
  );
}
