import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useLoadOlderMessages, useMarkConversationRead, useMessages, useSendMessage } from "@/lib/hooks/useChat";
import { cn, timeAgo } from "@/lib/utils";
import type { MessageRow } from "@/lib/types";

/**
 * Chat — fil de conversation (mission section 11). Pagination : charge les
 * 30 derniers messages, `onStartReached` (haut de liste, messages les plus
 * anciens en RN FlatList non inversée) déclenche le chargement d'une page
 * plus ancienne. Marque la conversation lue au montage (last_read_at).
 */
export default function ConversationThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");

  const { data: messages, isLoading, isError, refetch } = useMessages(id ?? null);
  const send = useSendMessage(id ?? "", profile?.id ?? "");
  const loadOlder = useLoadOlderMessages(id ?? null);
  const markRead = useMarkConversationRead(id ?? "", profile?.id ?? "");

  useEffect(() => {
    if (id && profile?.id) markRead.mutate();
    // Volontairement déclenché une seule fois par ouverture d'écran (pas à
    // chaque nouveau message) — suffisant pour un badge "non lu" simple.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id]);

  const handleSend = () => {
    const body = draft.trim();
    if (!body || !id) return;
    setDraft("");
    send.mutate(body, { onError: () => setDraft(body) });
  };

  if (isLoading) {
    return (
      <View className="flex-1 gap-3 bg-bg p-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16 w-2/3 self-end" />
      </View>
    );
  }
  if (isError) {
    return (
      <View className="flex-1 bg-bg p-4">
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
      <FlatList
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        onStartReached={() => loadOlder.mutate()}
        onStartReachedThreshold={0.3}
        renderItem={({ item }) => <MessageBubble message={item} isOwn={item.sender_id === profile?.id} />}
      />
      <View className="flex-row items-center gap-2 border-t border-border bg-bg p-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder="Écris un message…"
          className="flex-1"
          onSubmitEditing={handleSend}
          returnKeyType="send"
          accessibilityLabel="Message à envoyer"
        />
        <Pressable
          onPress={handleSend}
          disabled={!draft.trim() || send.isPending}
          accessibilityRole="button"
          accessibilityLabel="Envoyer le message"
          className={cn(
            "h-12 w-12 items-center justify-center rounded-2xl bg-accent active:scale-95",
            (!draft.trim() || send.isPending) && "opacity-50"
          )}
        >
          <Send size={18} color="#08090b" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, isOwn }: { message: MessageRow; isOwn: boolean }) {
  if (message.deleted_at) {
    return (
      <View className={cn("max-w-[80%] rounded-2xl px-3 py-2 bg-bg-elevated", isOwn ? "self-end" : "self-start")}>
        <Text className="text-xs italic text-fg-subtle">Message supprimé</Text>
      </View>
    );
  }
  return (
    <View className={cn("max-w-[80%] rounded-2xl px-3 py-2", isOwn ? "self-end bg-accent/20" : "self-start bg-bg-elevated")}>
      {!isOwn && <Text className="mb-0.5 text-[11px] font-bold text-fg-subtle">{message.sender?.username ?? "…"}</Text>}
      <Text className="text-sm text-fg">{message.body}</Text>
      <Text className="mt-0.5 text-[10px] text-fg-subtle">{timeAgo(message.created_at)}</Text>
    </View>
  );
}
