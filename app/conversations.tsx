import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { Screen, EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useConversations, getDirectConversationPeer } from "@/lib/hooks/useChat";
import { timeAgo } from "@/lib/utils";
import type { ConversationRow } from "@/lib/types";

/**
 * Chat — fondation (mission section 11). Liste des conversations DIRECT de
 * l'utilisateur connecté (GROUP/CLUB affichées si elles existent déjà, mais
 * aucune Edge Function ne permet encore de les créer depuis cet écran cette
 * session — voir rapport, section "Chat"). Aucun point d'entrée dans une tab
 * bar n'a été ajouté (voir mission section 37 : "NE PAS ajouter une
 * navigation concurrente") — accessible via router.push("/conversations")
 * et depuis le bouton "Message" du profil d'un joueur (ProfileContent).
 */
export default function ConversationsScreen() {
  const { profile } = useAuth();
  const { data: conversations, isLoading, isError, refetch } = useConversations(profile?.id ?? null);

  return (
    <Screen scroll={false}>
      <Text className="mb-4 font-display text-2xl text-fg">Messages</Text>
      {isLoading ? (
        <View className="gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </View>
      ) : isError ? (
        <ErrorState message="Impossible de charger tes conversations." onRetry={refetch} />
      ) : !conversations || conversations.length === 0 ? (
        <EmptyState title="Aucune conversation pour l'instant." subtitle="Ouvre le profil d'un joueur pour lui écrire." />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
          renderItem={({ item }) => <ConversationRowItem conversation={item} selfUserId={profile!.id} />}
        />
      )}
    </Screen>
  );
}

function ConversationRowItem({ conversation, selfUserId }: { conversation: ConversationRow; selfUserId: string }) {
  const peer = getDirectConversationPeer(conversation, selfUserId);
  const label = peer?.username ?? (conversation.type === "GROUP" ? "Groupe" : conversation.type === "CLUB" ? "Club" : "Conversation");

  return (
    <Pressable
      onPress={() => router.push(`/conversation/${conversation.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir la conversation avec ${label}`}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-bg-card p-3 active:opacity-80"
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
