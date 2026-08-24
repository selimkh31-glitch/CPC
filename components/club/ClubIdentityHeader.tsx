import { Text, View } from "react-native";
import { PulseDot } from "@/components/ui/PulseDot";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { clubIdentityLine, clubLanguagesLine } from "@/lib/clubProfile";
import type { ClubLevel, ClubSessionRow, Platform } from "@/lib/types";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";

/**
 * Identité club en tête de l'onglet Club — champs persistés uniquement
 * (nom, niveau, plateforme du owner, LIVE réel). Pas de mur de chips.
 */
export function ClubIdentityHeader({
  name,
  level,
  ownerPlatform,
  ownerUsername,
  languages,
  description,
  liveSession,
}: {
  name: string;
  level: ClubLevel;
  ownerPlatform: Platform | null;
  ownerUsername: string | null;
  languages: string[];
  description: string | null;
  liveSession: ClubSessionRow | null;
}) {
  const identity = clubIdentityLine({ level, ownerPlatform });
  const langs = clubLanguagesLine(languages);
  const needed =
    liveSession && liveSession.needed_positions.length > 0
      ? liveSession.needed_positions.map((p) => POSITION_LABELS[p as PositionCode] ?? p).join(" · ")
      : null;

  return (
    <View>
      <View className="flex-row items-center gap-2">
        {liveSession ? <PulseDot /> : null}
        <Text className="font-display text-3xl text-fg">{name}</Text>
      </View>
      <Text className="mt-1 text-sm text-fg-muted">{identity}</Text>
      {ownerUsername ? (
        <Text numberOfLines={1} className="mt-0.5 text-xs text-fg-subtle">
          Owner · {ownerUsername}
        </Text>
      ) : null}
      {langs ? <Text className="mt-0.5 text-xs text-fg-subtle">{langs}</Text> : null}
      {description ? <Text className="mt-2 text-sm text-fg-muted">{description}</Text> : null}

      {liveSession ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <Text className="text-xs font-extrabold uppercase tracking-wide text-accent">LIVE</Text>
          <LiveCountdown expiresAt={liveSession.expires_at} />
          {needed ? <Text className="text-xs text-fg-muted">Cherche {needed}</Text> : null}
        </View>
      ) : (
        <Text className="mt-3 text-xs text-fg-subtle">Hors ligne — aucune session LIVE active.</Text>
      )}
    </View>
  );
}
