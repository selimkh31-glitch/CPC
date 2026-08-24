import { Text } from "react-native";
import { router } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { useStartDirectConversation } from "@/lib/hooks/useChat";
import { BLOCKED_DM_COPY } from "@/lib/social";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Ouvre (ou retrouve) un DM via start-direct-conversation, puis push stack
 * `/conversation/[id]`. Si bloqué : pas d'appel Edge, copy honnête.
 */
export function StartDirectMessageButton({
  otherUserId,
  blocked = false,
  label = "Message",
  className,
}: {
  otherUserId: string;
  blocked?: boolean;
  label?: string;
  className?: string;
}) {
  const start = useStartDirectConversation();

  if (blocked) {
    return <Text className="text-sm text-fg-muted">{BLOCKED_DM_COPY}</Text>;
  }

  return (
    <Button
      variant="secondary"
      className={cn("min-h-[44px]", className)}
      icon={<MessageCircle size={15} color="#f4f5f7" />}
      loading={start.isPending}
      onPress={() =>
        start.mutate(otherUserId, {
          onSuccess: (data) => router.push(`/conversation/${data.conversation.id}`),
          onError: (err: any) => toast.error(err.message ?? "Impossible de démarrer la conversation."),
        })
      }
    >
      {label}
    </Button>
  );
}
