import { View } from "react-native";
import { FilterDropdown } from "@/components/live/FilterDropdown";
import { LANGUAGES, POSITIONS } from "@/lib/constants";
import { EMPTY_LIVE_FILTERS, type LiveFiltersState } from "@/lib/liveFilters";

export type { LiveFiltersState };
export { EMPTY_LIVE_FILTERS };

const POSITION_OPTIONS = POSITIONS.map((p) => ({
  value: p,
  label: p,
  hint: p,
}));

const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({
  value: l,
  label: l,
  hint: l,
}));

const RYTHME_OPTIONS = [
  { value: "CASUAL", label: "Chill", hint: "Chill" },
  { value: "COMPETITIVE", label: "Comp", hint: "Comp" },
];

/**
 * Filtres Matchmaking — Poste, Langue, Rythme. Pas de sheet Filtres, pas de plateforme.
 * Le matching moteur (poste + plateforme + TTL) n'est pas modifié.
 */
export function MatchmakingFilters({
  value,
  onChange,
}: {
  value: LiveFiltersState;
  onChange: (next: LiveFiltersState) => void;
}) {
  return (
    <View className="flex-row gap-2">
      <FilterDropdown
        label="Poste"
        value={value.position}
        options={POSITION_OPTIONS}
        onChange={(position) => onChange({ ...value, position })}
        allLabel="Tous les postes"
      />
      <FilterDropdown
        label="Langue"
        value={value.language}
        options={LANGUAGE_OPTIONS}
        onChange={(language) => onChange({ ...value, language })}
        allLabel="Toutes les langues"
      />
      <FilterDropdown
        label="Rythme"
        value={value.level}
        options={RYTHME_OPTIONS}
        onChange={(level) => onChange({ ...value, level })}
        allLabel="Tous les rythmes"
      />
    </View>
  );
}
