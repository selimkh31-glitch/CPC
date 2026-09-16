import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { callEdgeFunction } from "@/lib/api/edge";

export function useJoinLiveClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { clubId: string }) =>
      callEdgeFunction<{ ok: true; alreadyMember: boolean; clubId: string }>("join-live-club", input),
    onSuccess: (_data, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["club", variables.clubId] });
      queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
}

export function useClaimSlot(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { slotId: string; position: string }) =>
      callEdgeFunction<{ ok: true; alreadyClaimed: boolean; clubId: string; slotId: string }>("claim-slot", {
        clubId,
        slotId: input.slotId,
        position: input.position,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
}
