import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SlidersHorizontal } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { FilterDropdown } from "@/components/live/FilterDropdown";
import { Sheet } from "@/components/ui/Sheet";
import {
  CLUB_LEVELS,
  CLUB_LEVEL_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  PLATFORMS,
  PLATFORM_LABELS,
  POSITIONS,
  POSITION_LABELS,
} from "@/lib/constants";
import {
  EMPTY_LIVE_FILTERS,
  type LiveFiltersState,
  liveFiltersAreEmpty,
} from "@/lib/liveFilters";

export type { LiveFiltersState };
export { EMPTY_LIVE_FILTERS };

const POSITION_OPTIONS = POSITIONS.map((p) => ({
  value: p,
  label: `${p} — ${POSITION_LABELS[p]}`,
  hint: p,
}));

const PLATFORM_OPTIONS = PLATFORMS.map((p) => ({
  value: p,
  label: PLATFORM_LABELS[p],
  hint: p === "PS" ? "PS" : p === "XBOX" ? "Xbox" : "PC",
}));

const LEVEL_OPTIONS = CLUB_LEVELS.map((l) => ({
  value: l,
  label: CLUB_LEVEL_LABELS[l],
  hint: CLUB_LEVEL_LABELS[l],
}));

/** Filtres du feed LIVE — rangée compacte, langue derrière + Filtres. */
export function LiveFilters({
  value,
  onChange,
}: {
  value: LiveFiltersState;
  onChange: (next: LiveFiltersState) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActive = Boolean(value.language);

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <FilterDropdown
          label="Poste"
          value={value.position}
          options={POSITION_OPTIONS}
          onChange={(position) => onChange({ ...value, position })}
          allLabel="Tous les postes"
        />
        <FilterDropdown
          label="Plateforme"
          value={value.platform}
          options={PLATFORM_OPTIONS}
          onChange={(platform) => onChange({ ...value, platform })}
          allLabel="Toutes les plateformes"
        />
        <FilterDropdown
          label="Niveau"
          value={value.level}
          options={LEVEL_OPTIONS}
          onChange={(level) => onChange({ ...value, level })}
          allLabel="Tous les niveaux"
        />
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setMoreOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Plus de filtres"
          className={`min-h-[44px] flex-row items-center gap-1 rounded-xl border px-2.5 ${
            secondaryActive ? "border-border bg-bg-card" : "border-border bg-bg-elevated"
          }`}
        >
          <SlidersHorizontal size={14} color="#9aa0a8" />
          <Text className={`text-xs font-bold ${secondaryActive ? "text-fg" : "text-fg-muted"}`}>Filtres</Text>
        </Pressable>
      </View>

      <Sheet visible={moreOpen} onClose={() => setMoreOpen(false)} title="Filtres">
        <Text className="mb-2 text-xs text-fg-muted">Langue et préférences secondaires. Le matching reste poste + plateforme.</Text>
        <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Langue</Text>
        <View className="gap-1.5">
          <Pressable
            onPress={() => onChange({ ...value, language: "" })}
            className={`min-h-[44px] justify-center rounded-xl px-4 py-3 ${value.language === "" ? "bg-bg-card" : "bg-bg-elevated"}`}
          >
            <Text className={`font-semibold ${value.language === "" ? "text-fg" : "text-fg-muted"}`}>Toutes</Text>
          </Pressable>
          {LANGUAGES.map((l) => {
            const active = value.language === l;
            return (
              <Pressable
                key={l}
                onPress={() => {
                  Haptics.selectionAsync();
                  onChange({ ...value, language: active ? "" : l });
                }}
                className={`min-h-[44px] justify-center rounded-xl px-4 py-3 ${active ? "bg-bg-card" : "bg-bg-elevated"}`}
              >
                <Text className={`font-semibold ${active ? "text-fg" : "text-fg-muted"}`}>{LANGUAGE_LABELS[l]}</Text>
              </Pressable>
            );
          })}
        </View>
        {!liveFiltersAreEmpty(value) && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onChange(EMPTY_LIVE_FILTERS);
              setMoreOpen(false);
            }}
            className="mt-4 min-h-[44px] items-center justify-center py-2"
          >
            <Text className="text-sm font-bold text-fg-muted">Réinitialiser</Text>
          </Pressable>
        )}
      </Sheet>
    </View>
  );
}
