import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useConversations } from "@/lib/hooks/useChat";
import { conversationListLabel } from "@/lib/social";
import { timeAgo } from "@/lib/utils";
import type { ConversationRow } from "@/lib/types";

/**
 * Liste des conversations (DIRECT + GROUP + CLUB une fois provisionnée).
 * Pas d'onglet dédié — stack `/conversations` depuis Profil / Club.
 */
export default function ConversationsScreen() {
  const { profile } = useAuth();
  const { data: conversations, isLoading, isError, refetch } = useConversations(profile?.id ?? null);

  return (
    <View className="flex-1 bg-bg px-4 pt-4">
      {isLoading ? (
        <View className="gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </View>
      ) : isError ? (
        <ErrorState message="Impossible de charger tes conversations Pro Clubs." onRetry={refetch} />
      ) : !conversations || conversations.length === 0 ? (
        <EmptyState
          title="Aucune conversation pour l'instant."
            subtitle="Ouvre le profil d'un joueur Pro Clubs pour lui écrire. Groupes et conversation du club : une fois ouverts, ils apparaissent ici."
        />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
          renderItem={({ item }) => <ConversationRowItem conversation={item} selfUserId={profile!.id} />}
        />
      )}
    </View>
  );
}

function ConversationRowItem({ conversation, selfUserId }: { conversation: ConversationRow; selfUserId: string }) {
  const label = conversationListLabel(conversation, selfUserId);

  return (
    <Pressable
      onPress={() => router.push(`/conversation/${conversation.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir la conversation avec ${label}`}
      className="min-h-[44px] flex-row items-center gap-3 rounded-2xl border border-border bg-bg-card p-3 active:opacity-80"
    >
      <Avatar username={label} size="md" />
      <View className="flex-1">
        <Text className="font-display text-base text-fg">{label}</Text>
        <Text className="text-xs text-fg-subtle">{timeAgo(conversation.created_at)}</Text>
      </View>
      <MessageCircle size={18} color="#9aa0a8" />
    </Pressable>
  );
}
