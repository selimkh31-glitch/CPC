import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import { USER_PUBLIC_COLUMNS, type ReviewRow, type UserRow } from "@/lib/types";
import type { ScoutReport, SmartMatchResult } from "@/lib/ai-types";

export function useUserProfile(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select(USER_PUBLIC_COLUMNS)
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data as unknown as UserRow;
    },
  });
}

export function useUserReviews(userId: string | null) {
  return useQuery({
    queryKey: ["reviews", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, reviewer:users!reviews_reviewer_id_fkey(username)")
        .eq("target_user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as ReviewRow[];
    },
  });
}

export function useSubmitReview(targetUserId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ratingSkill: number; ratingBehavior: number; showedUp: boolean; comment?: string }) =>
      callEdgeFunction("submit-review", { targetUserId, ...input }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["reviews", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["profile", targetUserId] });
    },
  });
}

export function useLinkEaClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eaClubName: string) => callEdgeFunction<{ synced: boolean }>("link-ea-club", { eaClubName }),
    onSuccess: (_data, _vars, _ctx) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useScoutReport() {
  return useMutation({
    mutationFn: () => callEdgeFunction<{ report: ScoutReport }>("scout-report"),
  });
}

export function useSmartMatch() {
  return useQuery({
    queryKey: ["smart-match"],
    queryFn: () => callEdgeFunction<{ matches: SmartMatchResult[] }>("smart-match"),
    staleTime: 60_000,
  });
}
