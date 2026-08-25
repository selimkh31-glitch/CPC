import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CompetitionParticipants } from "@/components/competitions/CompetitionParticipants";
import { CompetitionRegisterCta } from "@/components/competitions/CompetitionRegisterCta";
import { CompetitionStandings } from "@/components/competitions/CompetitionStandings";
import {
  COMPETITION_COPY,
  COMPETITION_STATUS_LABELS,
  competitionCreatorLabel,
  competitionDetailHref,
  competitionRegisterCtaKind,
  type CompetitionStatus,
} from "@/lib/competitions";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";
import type { ClubRow, CompetitionRow } from "@/lib/types";

function statusTone(status: CompetitionStatus): "accent" | "neutral" | "warn" {
  if (status === "OPEN") return "accent";
  if (status === "CLOSED") return "warn";
  return "neutral";
}

export function CompetitionCard({
  competition,
  managedClub,
  viewerId,
  registering,
  linkedResults,
  linkedLoading,
  linkedError,
  onRetryLinked,
  onRegister,
}: {
  competition: CompetitionRow;
  managedClub: ClubRow | null;
  viewerId: string | null;
  registering: boolean;
  linkedResults: LinkedMatchResultRow[] | undefined;
  linkedLoading: boolean;
  linkedError: boolean;
  onRetryLinked: () => void;
  onRegister: () => void;
}) {
  const registeredIds = (competition.clubs ?? []).map((row) => row.club_id);
  const already = managedClub ? registeredIds.includes(managedClub.id) : false;
  const kind = competitionRegisterCtaKind({
    status: competition.status,
    hasManagedClub: Boolean(managedClub),
    alreadyRegistered: already,
  });
  const href = competitionDetailHref(competition.id);
  const creator = competitionCreatorLabel(competition, viewerId);

  return (
    <Card>
      <Pressable
        onPress={() => router.push(href)}
        accessibilityRole="button"
        accessibilityLabel={`${competition.name}. ${COMPETITION_STATUS_LABELS[competition.status]}`}
        className="min-h-[44px]"
      >
        <View className="mb-2 flex-row items-start justify-between gap-2">
          <Text className="min-w-0 flex-1 font-display text-lg text-fg">{competition.name}</Text>
          <Badge tone={statusTone(competition.status)}>{COMPETITION_STATUS_LABELS[competition.status]}</Badge>
        </View>
        <Text className="mb-2 text-xs text-fg-subtle">
          {COMPETITION_COPY.creatorLabel} · {creator}
        </Text>
        {competition.status === "OPEN" ? (
          <Text className="mb-2 text-xs text-fg-muted">{COMPETITION_COPY.openJoinHint}</Text>
        ) : null}
        <CompetitionParticipants clubs={competition.clubs} />
      </Pressable>
      <View className="mt-3">
        <CompetitionRegisterCta
          kind={kind}
          clubName={managedClub?.name}
          loading={registering}
          onRegister={onRegister}
        />
      </View>
      <CompetitionStandings
        competition={competition}
        results={linkedResults}
        isLoading={linkedLoading}
        isError={linkedError}
        onRetry={onRetryLinked}
      />
    </Card>
  );
}
