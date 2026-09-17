import { Text, View } from "react-native";
import { Badge } from "@/components/ui/Badge";
import { ProfileRow } from "@/components/ui/ProfileRow";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { sortClubRoster } from "@/lib/clubProfile";
import { cpcHex } from "@/lib/design/cpc-native";
import type { ClubMemberRow, ClubRole } from "@/lib/types";
import { router } from "expo-router";

const ROLE_LABEL: Record<ClubRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  MEMBER: "Membre",
};

/**
 * Effectif réel (`club_members`) — distinct du XI (`slot_assignments`).
 * Lecture seule. Le terrain n'affiche que les titulaires.
 */
export function ClubRosterList({
  members,
  currentUserId = null,
  clubId = null,
  title = "Membres",
}: {
  members: ClubMemberRow[] | null | undefined;
  currentUserId?: string | null;
  clubId?: string | null;
  title?: string;
}) {
  const roster = sortClubRoster(members ?? []).filter(Boolean);

  return (
    <View className="gap-2">
      <SectionHeader title={`${title} (${roster.length})`} />
      {roster.length === 0 ? (
        <Text className="font-sans text-body text-fg-muted" style={{ color: cpcHex.textMuted }}>
          Aucun membre dans ce club pour l&apos;instant.
        </Text>
      ) : (
        <View className="gap-1">
          {roster.map((m) => {
            const name = m.user?.username?.trim() || "Joueur";
            const isSelf = Boolean(currentUserId && m.user_id === currentUserId);
            const href = m.user
              ? clubId
                ? `/profile/${m.user_id}?clubId=${encodeURIComponent(clubId)}`
                : `/profile/${m.user_id}`
              : null;
            return (
              <View key={m.id ?? m.user_id} className="min-h-[44px] flex-row items-center gap-2">
                <View className="min-w-0 flex-1">
                  <ProfileRow
                    name={name}
                    meta={isSelf ? "Vous" : undefined}
                    onPress={href ? () => router.push(href) : undefined}
                  />
                </View>
                <Badge tone={m.role === "OWNER" ? "pro" : m.role === "MANAGER" ? "accent" : "neutral"}>
                  {ROLE_LABEL[m.role]}
                </Badge>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
