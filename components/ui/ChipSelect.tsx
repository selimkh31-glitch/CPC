import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { cn } from "@/lib/utils";
import { cpcHex } from "@/lib/design/cpc-native";

interface ChipOption {
  value: string;
  label: string;
}

interface ChipSelectProps {
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  single?: boolean;
  /** Seulement à l'ajout au-delà de `max` — jamais au retrait. */
  onMax?: () => void;
}

/** Sélecteur de "chips" tactile, zones de touch généreuses — coeur de l'onboarding rapide (<10s/étape). */
export function ChipSelect({ options, value, onChange, max, single, onMax }: ChipSelectProps) {
  const toggle = (v: string) => {
    Haptics.selectionAsync();
    if (single) {
      onChange(value[0] === v ? [] : [v]);
      return;
    }
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      if (max && value.length >= max) {
        onMax?.();
        return;
      }
      onChange([...value, v]);
    }
  };

  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => toggle(opt.value)}
            className={cn(
              "min-h-[44px] min-w-[44px] items-center justify-center border px-4 active:scale-95",
              active ? "border-accent bg-accent/15" : "border-border bg-bg-elevated"
            )}
          >
            <Text
              className={cn("text-sm font-semibold", active ? "text-accent" : "text-fg-muted")}
              style={{ color: active ? cpcHex.accent : cpcHex.textMuted }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
