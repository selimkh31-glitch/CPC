import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import { validateProfileIdentity } from "@/lib/profileIdentity";
import { useAuth } from "@/lib/providers/AuthProvider";
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

/**
 * Mise à jour de sa propre identité Pro Clubs via RLS `users_update_self`.
 * Le payload passe par l'allowlist : reliability_score, verified_stats,
 * ea_identity_kind et plan ne sont jamais envoyés.
 */
export function useUpdateOwnProfile() {
  const queryClient = useQueryClient();
  const { session, refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      if (!session) throw new Error("Session requise.");
      const validated = validateProfileIdentity(input);
      if (!validated.ok) throw new Error(validated.message);
      const { data, error } = await supabase
        .from("users")
        .update(validated.patch)
        .eq("id", session.user.id)
        .select(USER_PUBLIC_COLUMNS)
        .single();
      if (error) throw error;
      return data as unknown as UserRow;
    },
    onSuccess: async (_row, _vars) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export type EaClubCandidate = {
  clubId: string;
  name: string;
  platform?: string | null;
  rank?: number | null;
  gamesPlayed?: number | null;
};

export type SearchEaClubResult = { candidates: EaClubCandidate[]; unavailable: boolean };

export type LinkEaClubResult = {
  synced: boolean;
  clubId?: string;
  name?: string;
  eaClubId?: string;
};

export type PreviewEaClubResult = {
  clubId: string;
  name: string;
  platform?: string | null;
  members: string[];
};

export function useSearchEaClub() {
  return useMutation({
    mutationFn: (eaClubName: string) =>
      callEdgeFunction<SearchEaClubResult>("link-ea-club", { action: "search", eaClubName }),
  });
}

export function usePreviewEaClub() {
  return useMutation({
    mutationFn: (input: { eaClubId: string; eaClubName: string }) =>
      callEdgeFunction<PreviewEaClubResult>("link-ea-club", { action: "preview", ...input }),
  });
}

export function useLinkEaClub() {
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();
  return useMutation({
    mutationFn: (input: { eaClubId: string; eaClubName: string }) =>
      callEdgeFunction<LinkEaClubResult>("link-ea-club", { action: "link", ...input }),
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useUnlinkEaClub() {
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();
  return useMutation({
    mutationFn: () => callEdgeFunction<{ unlinked: boolean }>("link-ea-club", { action: "unlink" }),
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshProfile();
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
