import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSmartMatch } from "@/lib/hooks/useProfile";

/** Smart Match IA (section 5) — top clubs recommandés pour le joueur connecté. */
export function SmartMatchBanner() {
  const { data, isLoading } = useSmartMatch();

  if (isLoading) return <Skeleton className="h-24 mb-4" />;
  const matches = data?.matches?.slice(0, 3) ?? [];
  if (matches.length === 0) return null;

  return (
    <View className="mb-4 rounded-2xl border border-pro/30 bg-pro/10 p-4">
      <View className="mb-2 flex-row items-center gap-1.5">
        <Sparkles size={15} color="#ae8bff" />
        <Text className="text-xs font-extrabold uppercase tracking-wide text-pro-200">
          Smart Match — recommandé pour toi
        </Text>
      </View>
      <View className="gap-1.5">
        {matches.map((m) => (
          <Pressable key={m.clubId} onPress={() => router.push(`/club/${m.clubId}`)} className="flex-row items-center justify-between">
            <Text numberOfLines={1} className="flex-1 text-sm text-fg">
              {m.reason}
            </Text>
            <Text className="ml-2 text-sm font-extrabold text-pro-300">{m.score}%</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
