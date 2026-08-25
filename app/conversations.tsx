import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useConversations } from "@/lib/hooks/useChat";
import {
  CHAT_UX_COPY,
  conversationIsUnread,
  conversationKindLabel,
  conversationListLabel,
  conversationMessagePreview,
} from "@/lib/social";
import { timeAgo } from "@/lib/utils";
import type { ConversationRow } from "@/lib/types";

/**
 * Liste des conversations (DIRECT + GROUP + CLUB).
 * Une ligne = un vrai nom + dernier message. Pas d'onglet dédié.
 */
export default function ConversationsScreen() {
  const { profile } = useAuth();
  const { data: conversations, isLoading, isError, refetch } = useConversations(profile?.id ?? null);

  return (
    <View className="flex-1 bg-bg px-5 pt-4">
      {isLoading ? (
        <View className="gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </View>
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

function ConversationRowItem({ conversation, selfUserId }: { conversation: ConversationRow; selfUserId: string }) {
  const label = conversationListLabel(conversation, selfUserId);
  const kind = conversationKindLabel(conversation.type);
  const preview = conversationMessagePreview(conversation.last_message);
  const when = conversation.last_message?.created_at ?? conversation.created_at;
  const unread = conversationIsUnread({
    selfUserId,
    members: conversation.members,
    lastMessageAt: conversation.last_message?.created_at ?? null,
  });

  return (
    <Pressable
      onPress={() => router.push(`/conversation/${conversation.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${label}`}
      className="min-h-[64px] flex-row items-center gap-3 py-3 active:opacity-80"
    >
      <Avatar username={label} size="md" />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-display text-base text-fg">
          {label}
        </Text>
        {preview ? (
          <Text numberOfLines={1} className={unread ? "mt-0.5 text-sm text-fg-muted" : "mt-0.5 text-sm text-fg-subtle"}>
            {preview}
          </Text>
        ) : kind ? (
          <Text numberOfLines={1} className="mt-0.5 text-sm text-fg-subtle">
            {kind}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1.5">
        <Text className="text-[11px] text-fg-subtle">{timeAgo(when)}</Text>
        {unread ? <View className="h-2 w-2 rounded-full bg-accent" accessibilityLabel="Non lu" /> : null}
      </View>
    </Pressable>
  );
}
