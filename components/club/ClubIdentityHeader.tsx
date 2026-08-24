import { Text, View } from "react-native";
import { clubIdentityLine, clubLanguagesLine } from "@/lib/clubProfile";
import type { ClubLevel, Platform } from "@/lib/types";

/**
 * Identité club — champs persistés uniquement (nom, niveau, plateforme owner).
 * L'état LIVE / match lancé vit dans ClubSessionStatus, pas ici.
 */
export function ClubIdentityHeader({
  name,
  level,
  ownerPlatform,
  ownerUsername,
  languages,
  description,
}: {
  name: string;
  level: ClubLevel;
  ownerPlatform: Platform | null;
  ownerUsername: string | null;
  languages: string[];
  description: string | null;
}) {
  const identity = clubIdentityLine({ level, ownerPlatform });
  const langs = clubLanguagesLine(languages);

  return (
    <View>
      <Text className="font-display text-3xl text-fg">{name}</Text>
      <Text className="mt-1 text-sm text-fg-muted">{identity}</Text>
      {ownerUsername ? (
        <Text numberOfLines={1} className="mt-0.5 text-xs text-fg-subtle">
          Owner · {ownerUsername}
        </Text>
      ) : null}
      {langs ? <Text className="mt-0.5 text-xs text-fg-subtle">{langs}</Text> : null}
      {description ? <Text className="mt-2 text-sm text-fg-muted">{description}</Text> : null}
    </View>
  );
}
