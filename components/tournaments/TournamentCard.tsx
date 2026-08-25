import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CompetitionParticipants } from "@/components/competitions/CompetitionParticipants";
import { CompetitionRegisterCta } from "@/components/competitions/CompetitionRegisterCta";
import {
  competitionCreatorLabel,
  competitionRegisterCtaKind,
  type CompetitionStatus,
} from "@/lib/competitions";
import { TOURNAMENT_COPY, TOURNAMENT_STATUS_LABELS, tournamentDetailHref } from "@/lib/tournaments";
import type { ClubRow, CompetitionRow } from "@/lib/types";

function statusTone(status: CompetitionStatus): "accent" | "neutral" | "warn" {
  if (status === "OPEN") return "accent";
  if (status === "CLOSED") return "warn";
  return "neutral";
}

export function TournamentCard({
  tournament,
  managedClub,
  viewerId,
  registering,
  onRegister,
}: {
  tournament: CompetitionRow;
  managedClub: ClubRow | null;
  viewerId: string | null;
  registering: boolean;
  onRegister: () => void;
}) {
  const registeredIds = (tournament.clubs ?? []).map((row) => row.club_id);
  const already = managedClub ? registeredIds.includes(managedClub.id) : false;
  const kind = competitionRegisterCtaKind({
    status: tournament.status,
    hasManagedClub: Boolean(managedClub),
    alreadyRegistered: already,
  });
  const href = tournamentDetailHref(tournament.id);
  const creator = competitionCreatorLabel(tournament, viewerId);

  return (
    <Card>
      <Pressable
        onPress={() => router.push(href)}
        accessibilityRole="button"
        accessibilityLabel={`${tournament.name}. ${TOURNAMENT_STATUS_LABELS[tournament.status]}`}
        className="min-h-[44px]"
      >
        <View className="mb-2 flex-row items-start justify-between gap-2">
          <Text className="min-w-0 flex-1 font-display text-lg text-fg">{tournament.name}</Text>
          <Badge tone={statusTone(tournament.status)}>{TOURNAMENT_STATUS_LABELS[tournament.status]}</Badge>
        </View>
        <Text className="mb-2 text-xs text-fg-subtle">
          {TOURNAMENT_COPY.creatorLabel} · {creator}
        </Text>
        {tournament.status === "OPEN" ? (
          <Text className="mb-2 text-xs text-fg-muted">{TOURNAMENT_COPY.openJoinHint}</Text>
        ) : null}
        <CompetitionParticipants clubs={tournament.clubs} />
      </Pressable>
      <View className="mt-3">
        <CompetitionRegisterCta
          kind={kind}
          clubName={managedClub?.name}
          loading={registering}
          alreadyRegisteredLabel={TOURNAMENT_COPY.alreadyRegistered}
          draftLabel={TOURNAMENT_COPY.draftCannotRegister}
          closedLabel={TOURNAMENT_COPY.closedCannotRegister}
          noManagedClubLabel={TOURNAMENT_COPY.noManagedClub}
          registerCtaLabel={TOURNAMENT_COPY.registerCta}
          onRegister={onRegister}
        />
      </View>
    </Card>
  );
}
