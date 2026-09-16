import { Text, View } from "react-native";
import { cn } from "@/lib/utils";

export function ChatMessage({
  body,
  isOwn,
  sender,
  at,
  deleted,
  deletedLabel,
}: {
  body: string;
  isOwn: boolean;
  sender?: string;
  at: string;
  deleted?: boolean;
  deletedLabel?: string;
}) {
  if (deleted) {
    return (
      <View className={cn("max-w-[80%] bg-bg-elevated px-3 py-2", isOwn ? "self-end" : "self-start")}>
        <Text className="text-xs italic text-fg-subtle">{deletedLabel ?? "Message supprimé"}</Text>
      </View>
    );
  }

  return (
    <View className={cn("max-w-[80%] px-3.5 py-2.5", isOwn ? "self-end bg-accent/20" : "self-start bg-bg-elevated")}>
      {!isOwn && sender ? <Text className="mb-1 text-xs font-semibold text-fg-muted">{sender}</Text> : null}
      <Text className="text-[15px] leading-5 text-fg">{body}</Text>
      <Text className="mt-1 text-caption text-fg-subtle">{at}</Text>
    </View>
  );
}
