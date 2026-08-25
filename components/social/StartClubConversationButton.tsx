import { router } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { useStartClubConversation } from "@/lib/hooks/useChat";
import { CLUB_CONVERSATION_COPY, canOpenClubConversation } from "@/lib/social";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ClubRole } from "@/lib/types";

/**
 * Onglet Club (effectif) — get-or-create la conversation CLUB via
 * start-club-conversation, puis push `/conversation/[id]` (même UI que DM /
 * groupe). OWNER / MANAGER / MEMBER. 44 pt, copy FR.
 */
export function StartClubConversationButton({
  clubId,
  role,
  className,
}: {
  clubId: string;
  role: ClubRole | null | undefined;
  className?: string;
}) {
  const start = useStartClubConversation();

  if (!canOpenClubConversation(role)) return null;

  return (
    <Button
      variant="ghost"
      className={cn("min-h-[44px] w-full", className)}
      icon={<MessageCircle size={16} color="#9aa0a8" />}
      loading={start.isPending}
      accessibilityLabel={CLUB_CONVERSATION_COPY}
      onPress={() =>
        start.mutate(clubId, {
          onSuccess: (data) => router.push(`/conversation/${data.conversation.id}`),
          onError: (err: Error) => toast.error(err.message ?? "Impossible d'ouvrir la conversation du club."),
        })
      }
    >
      {CLUB_CONVERSATION_COPY}
    </Button>
  );
}
