import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/Screen";
import { ConversationRow } from "@/components/ui/ConversationRow";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useConversations } from "@/lib/hooks/useChat";
import {
  CHAT_UX_COPY,
  conversationIsUnread,
  conversationKindLabel,
  conversationListLabel,
  conversationMessagePreview,
} from "@/lib/social";
import type { ConversationRow as ConversationRowType } from "@/lib/types";

/**
 * Liste des conversations (DIRECT + GROUP + CLUB).
 * Une ligne = un vrai nom + dernier message. Pas d'onglet dédié.
 */
export default function ConversationsScreen() {
  const { profile } = useAuth();
  const { data: conversations, isLoading, isError, refetch } = useConversations(profile?.id ?? null);

  return (
    <View className="flex-1 bg-bg px-4 pt-4">
      {isLoading ? (
        <SkeletonList rows={2} />
      ) : isError ? (
        <ErrorState message="Impossible de charger tes messages." onRetry={refetch} />
      ) : !conversations || conversations.length === 0 ? (
        <View>
          <EmptyState title={CHAT_UX_COPY.listEmptyTitle} subtitle={CHAT_UX_COPY.listEmptySubtitle} />
          <Pressable
            onPress={() => router.push("/groups")}
            className="mt-4 min-h-[44px] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={CHAT_UX_COPY.newGroup}
          >
            <Text className="text-sm font-bold text-accent">{CHAT_UX_COPY.newGroup}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: 4, paddingBottom: 32 }}
          ListHeaderComponent={
            <Pressable
              onPress={() => router.push("/groups")}
              className="mb-3 min-h-[44px] justify-center"
              accessibilityRole="button"
              accessibilityLabel={CHAT_UX_COPY.newGroup}
            >
              <Text className="text-sm text-fg-subtle">{CHAT_UX_COPY.newGroup}</Text>
            </Pressable>
          }
          renderItem={({ item }) => <ConversationRowItem conversation={item} selfUserId={profile!.id} />}
        />
      )}
    </View>
  );
}

function ConversationRowItem({ conversation, selfUserId }: { conversation: ConversationRowType; selfUserId: string }) {
  const label = conversationListLabel(conversation, selfUserId);
  const kind = conversationKindLabel(conversation.type);
  const preview = conversationMessagePreview(conversation.last_message) ?? kind;
  const when = conversation.last_message?.created_at ?? conversation.created_at;
  const unread = conversationIsUnread({
    selfUserId,
    members: conversation.members,
    lastMessageAt: conversation.last_message?.created_at ?? null,
  });

  return (
    <ConversationRow
      label={label}
      preview={preview}
      when={when}
      unread={unread}
      onPress={() => router.push(`/conversation/${conversation.id}`)}
    />
  );
}
