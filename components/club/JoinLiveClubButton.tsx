import { router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { useJoinLiveClub } from "@/lib/hooks/useJoinLiveClub";
import { playerInvitationAcceptHref } from "@/lib/recruitment";
import { toast } from "@/lib/toast";

/**
 * Rejoindre un club LIVE : membership MEMBER d'abord, puis feuille.
 * Jamais l'Edge `apply` (candidature à un poste).
 */
export function JoinLiveClubButton({
  clubId,
  label = "Rejoindre",
  size = "sm",
  navigateToSheet = true,
}: {
  clubId: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  navigateToSheet?: boolean;
}) {
  const join = useJoinLiveClub();

  return (
    <Button
      size={size}
      loading={join.isPending}
      disabled={join.isPending}
      accessibilityLabel={label}
      onPress={() => {
        if (join.isPending) return;
        join.mutate(
          { clubId },
          {
            onSuccess: () => {
              const href = playerInvitationAcceptHref(clubId);
              if (navigateToSheet && href) {
                router.push(href);
                return;
              }
              toast.success("Club rejoint.");
            },
            onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible de rejoindre."),
          }
        );
      }}
    >
      {label}
    </Button>
  );
}
