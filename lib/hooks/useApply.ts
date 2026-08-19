import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { callEdgeFunction } from "@/lib/api/edge";

/** Bouton "Postuler" en 1 clic (section 3.D) — passe par l'Edge Function `apply` (gating + modération). */
export function useApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; position: string; slotId?: string; message?: string }) =>
      callEdgeFunction("apply", input),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
}
