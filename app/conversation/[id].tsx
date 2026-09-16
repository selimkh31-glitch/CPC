import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChatMessage } from "@/components/ui/ChatMessage";
import { ChatComposer } from "@/components/ui/ChatComposer";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useConversation, useLoadOlderMessages, useMarkConversationRead, useMessages, useSendMessage } from "@/lib/hooks/useChat";
import { useBlockedUserIds } from "@/lib/hooks/useSafety";
import {
  BLOCKED_DM_COPY,
  CHAT_UX_COPY,
  conversationKindLabel,
  conversationListLabel,
  isDirectPeerBlocked,
} from "@/lib/social";
import { toast } from "@/lib/toast";
import { timeAgo } from "@/lib/utils";

/**
 * Fil unique DM / groupe / club — même composer. Distinct seulement en en-tête.
 * Pagination 30, realtime, last_read_at au montage. Keyboard / safe-area inchangés.
 */
export default function ConversationThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");

  const { data: conversation } = useConversation(id ?? null);
  const { data: blockedIds } = useBlockedUserIds(profile?.id ?? null);
  const { data: messages, isLoading, isError, refetch } = useMessages(id ?? null);
  const send = useSendMessage(id ?? "", profile?.id ?? "");
  const loadOlder = useLoadOlderMessages(id ?? null);
  const markRead = useMarkConversationRead(id ?? "", profile?.id ?? "");

  const title =
    conversation && profile?.id ? conversationListLabel(conversation, profile.id) : "";
  const kind = conversation ? conversationKindLabel(conversation.type) : null;
  const peerBlocked = Boolean(
    conversation && profile?.id && isDirectPeerBlocked(conversation, profile.id, blockedIds ?? [])
  );

  useEffect(() => {
    if (id && profile?.id) markRead.mutate();
    // Volontairement déclenché une seule fois par ouverture d'écran (pas à
    // chaque nouveau message) — suffisant pour un badge "non lu" simple.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id]);

  const handleSend = () => {
    const body = draft.trim();
    if (!body || !id || peerBlocked) return;
    setDraft("");
    send.mutate(body, {
      onError: (err: any) => {
        setDraft(body);
        toast.error(err?.message ?? "Impossible d'envoyer.");
      },
    });
  };

  const header = (
    <Stack.Screen
      options={{
        headerTitle: () => (
          <View className="max-w-[220px] items-center">
            <Text numberOfLines={1} className="font-display text-base text-fg">
              {title}
            </Text>
            {kind ? <Text className="font-sans text-eyebrow text-fg-subtle">{kind}</Text> : null}
          </View>
        ),
      }}
    />
  );

  if (isLoading) {
    return (
      <View className="flex-1 gap-3 bg-bg p-4">
        {header}
        <Skeleton className="h-16" />
        <Skeleton className="h-16 w-2/3 self-end" />
      </View>
    );
  }
  if (isError) {
    return (
      <View className="flex-1 bg-bg p-4">
        {header}
        <ErrorState message="Impossible de charger cette conversation." onRetry={refetch} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 44}
      style={{ flex: 1 }}
      className="bg-bg"
    >
      {header}
      <FlatList
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 16 }}
        onStartReached={() => loadOlder.mutate()}
        onStartReachedThreshold={0.3}
        renderItem={({ item }) => (
          <ChatMessage
            body={item.body}
            isOwn={item.sender_id === profile?.id}
            sender={item.sender?.username ?? "…"}
            at={timeAgo(item.created_at)}
            deleted={Boolean(item.deleted_at)}
            deletedLabel={CHAT_UX_COPY.deleted}
          />
        )}
        ListEmptyComponent={<EmptyState title={CHAT_UX_COPY.threadEmptyTitle} />}
      />
      {peerBlocked ? (
        <View className="border-t border-border bg-bg px-4 py-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Text className="text-sm text-fg-muted">{BLOCKED_DM_COPY}</Text>
        </View>
      ) : (
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          placeholder={CHAT_UX_COPY.composerPlaceholder}
          sendLabel={CHAT_UX_COPY.send}
          disabled={send.isPending}
          loading={send.isPending}
          bottomInset={insets.bottom}
        />
      )}
    </KeyboardAvoidingView>
  );
}
