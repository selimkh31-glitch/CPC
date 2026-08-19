import { ScrollView, Text, View } from "react-native";
import { ChipSelect } from "@/components/ui/ChipSelect";
import {
  CLUB_LEVELS, CLUB_LEVEL_LABELS, LANGUAGES, LANGUAGE_LABELS, POSITIONS, POSITION_LABELS,
} from "@/lib/constants";

export interface LiveFiltersState {
  position: string;
  level: string;
  language: string;
}

export const EMPTY_LIVE_FILTERS: LiveFiltersState = { position: "", level: "", language: "" };

/** Filtres du Live Feed (section 3.C) — poste, niveau, langue. Chips tactiles, une ligne par catégorie. */
export function LiveFilters({
  value,
  onChange,
}: {
  value: LiveFiltersState;
  onChange: (next: LiveFiltersState) => void;
}) {
  return (
    <View className="gap-2.5">
      <FilterRow label="Poste">
        <ChipSelect
          single
          value={value.position ? [value.position] : []}
          onChange={(v) => onChange({ ...value, position: v[0] ?? "" })}
          options={POSITIONS.map((p) => ({ value: p, label: POSITION_LABELS[p] }))}
        />
      </FilterRow>
      <FilterRow label="Niveau">
        <ChipSelect
          single
          value={value.level ? [value.level] : []}
          onChange={(v) => onChange({ ...value, level: v[0] ?? "" })}
          options={CLUB_LEVELS.map((l) => ({ value: l, label: CLUB_LEVEL_LABELS[l] }))}
        />
      </FilterRow>
      <FilterRow label="Langue">
        <ChipSelect
          single
          value={value.language ? [value.language] : []}
          onChange={(v) => onChange({ ...value, language: v[0] ?? "" })}
          options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
        />
      </FilterRow>
    </View>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}
