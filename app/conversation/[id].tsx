import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
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
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { MessageRow } from "@/lib/types";

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
            {kind ? <Text className="text-[11px] text-fg-subtle">{kind}</Text> : null}
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
        renderItem={({ item }) => <MessageBubble message={item} isOwn={item.sender_id === profile?.id} />}
        ListEmptyComponent={<EmptyState title={CHAT_UX_COPY.threadEmptyTitle} />}
      />
      {peerBlocked ? (
        <View className="border-t border-border bg-bg px-4 py-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Text className="text-sm text-fg-muted">{BLOCKED_DM_COPY}</Text>
        </View>
      ) : (
        <View
          className="flex-row items-center gap-2 border-t border-border bg-bg px-3 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={CHAT_UX_COPY.composerPlaceholder}
            className="min-h-[48px] flex-1"
            onSubmitEditing={handleSend}
            returnKeyType="send"
            accessibilityLabel={CHAT_UX_COPY.composerPlaceholder}
          />
          <Button
            className="min-h-[48px] px-5"
            disabled={!draft.trim() || send.isPending}
            loading={send.isPending}
            onPress={handleSend}
            accessibilityLabel={CHAT_UX_COPY.send}
          >
            {CHAT_UX_COPY.send}
          </Button>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, isOwn }: { message: MessageRow; isOwn: boolean }) {
  if (message.deleted_at) {
    return (
      <View className={cn("max-w-[80%] rounded-2xl px-3 py-2 bg-bg-elevated", isOwn ? "self-end" : "self-start")}>
        <Text className="text-xs italic text-fg-subtle">{CHAT_UX_COPY.deleted}</Text>
      </View>
    );
  }
  return (
    <View className={cn("max-w-[80%] rounded-[20px] px-3.5 py-2.5", isOwn ? "self-end bg-accent/20" : "self-start bg-bg-elevated")}>
      {!isOwn && (
        <Text className="mb-1 text-xs font-semibold text-fg-muted">{message.sender?.username ?? "…"}</Text>
      )}
      <Text className="text-[15px] leading-5 text-fg">{message.body}</Text>
      <Text className="mt-1 text-[10px] text-fg-subtle">{timeAgo(message.created_at)}</Text>
    </View>
  );
}
