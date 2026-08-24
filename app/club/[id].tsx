import { ScrollView, Text, View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Globe2, Users } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PulseDot } from "@/components/ui/PulseDot";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { ApplyForm } from "@/components/club/ApplyForm";
import { useClub } from "@/lib/hooks/useClubs";
import { useAuth } from "@/lib/providers/AuthProvider";
import { CLUB_LEVEL_LABELS, LANGUAGE_LABELS, POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { findActiveLiveSession } from "@/lib/live";

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: club, isLoading, isError, refetch } = useClub(id);
  const { session } = useAuth();

  if (isError) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <ErrorState message="Impossible de charger ce club." onRetry={refetch} />
      </ScrollView>
    );
  }

  if (isLoading || !club) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </ScrollView>
    );
  }

  const activeSession = findActiveLiveSession(club.sessions, Date.now());
  const isMember = session ? club.members?.some((m) => m.user_id === session.user.id) : false;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
      <View>
        <View className="flex-row items-center gap-2">
          {activeSession && <PulseDot />}
          <Text className="font-display text-3xl text-fg">{club.name}</Text>
        </View>
        <View className="mt-1 flex-row items-center gap-2">
          <Badge tone={club.level === "COMPETITIVE" ? "accent" : "neutral"}>{CLUB_LEVEL_LABELS[club.level]}</Badge>
          <View className="flex-row items-center gap-1">
            <Globe2 size={12} color="#666c74" />
            <Text className="text-xs text-fg-subtle">{club.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")}</Text>
          </View>
        </View>
        {club.description && <Text className="mt-3 text-sm text-fg-muted">{club.description}</Text>}
        <Link href={`/match-sheet?clubId=${club.id}`} className="mt-2 text-sm text-accent">
          Voir la feuille de match
        </Link>
      </View>

      <Card>
        <Text className="mb-2 font-display text-lg text-fg">Session</Text>
        {activeSession ? (
          <>
            <View className="mb-3 flex-row flex-wrap gap-1.5">
              {activeSession.needed_positions.map((p) => (
                <Badge key={p} tone="pro">
                  {POSITION_LABELS[p as PositionCode] ?? p}
                </Badge>
              ))}
            </View>
            {activeSession.note && <Text className="mb-3 text-sm text-fg-muted">{activeSession.note}</Text>}
            {session && !isMember ? (
              <ApplyForm sessionId={activeSession.id} neededPositions={activeSession.needed_positions} />
            ) : !session ? (
              <Link href="/(auth)/login" className="text-sm text-accent">
                Connecte-toi pour postuler
              </Link>
            ) : (
              <Text className="text-sm text-fg-subtle">Tu es déjà membre de ce club.</Text>
            )}
          </>
        ) : (
          <Text className="text-sm text-fg-muted">Ce club n&apos;est pas live actuellement.</Text>
        )}
      </Card>

      <Card>
        <View className="mb-2 flex-row items-center gap-2">
          <Users size={18} color="#f4f5f7" />
          <Text className="font-display text-lg text-fg">Membres ({club.members?.length ?? 0})</Text>
        </View>
        <View className="gap-1.5">
          {(club.members ?? []).map((m) => (
            <View key={m.id} className="flex-row items-center justify-between">
              <Text
                className="text-sm text-fg"
                onPress={() => router.push(`/profile/${m.user_id}`)}
                suppressHighlighting
              >
                {m.user?.username}
              </Text>
              <Badge tone={m.role === "OWNER" ? "pro" : "neutral"}>{m.role}</Badge>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
