import { router } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { useStartClubConversation } from "@/lib/hooks/useChat";
import { CHAT_UX_COPY, canOpenClubConversation } from "@/lib/social";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ClubRole } from "@/lib/types";

/**
 * Onglet Club — ouvre la conversation CLUB (même fil que DM / groupe).
 * Le nom du club est l'en-tête du fil, pas ce bouton.
 */
export function StartClubConversationButton({
  clubId,
  role,
  clubName,
  className,
}: {
  clubId: string;
  role: ClubRole | null | undefined;
  clubName?: string | null;
  className?: string;
}) {
  const start = useStartClubConversation();

  if (!canOpenClubConversation(role)) return null;

  const trimmed = typeof clubName === "string" ? clubName.trim() : "";
  const accessibilityLabel = trimmed ? `${CHAT_UX_COPY.write} — ${trimmed}` : CHAT_UX_COPY.write;

  return (
    <Button
      variant="ghost"
      className={cn("min-h-[44px] w-full", className)}
      icon={<MessageCircle size={16} color="#9aa0a8" />}
      loading={start.isPending}
      accessibilityLabel={accessibilityLabel}
      onPress={() =>
        start.mutate(clubId, {
          onSuccess: (data) => router.push(`/conversation/${data.conversation.id}`),
          onError: (err: Error) => toast.error(err.message ?? "Impossible d'ouvrir."),
        })
      }
    >
      {CHAT_UX_COPY.write}
    </Button>
  );
}
