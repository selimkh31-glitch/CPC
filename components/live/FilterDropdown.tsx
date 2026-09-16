import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

export interface FilterDropdownOption {
  value: string;
  label: string;
  hint?: string;
}

/** Sélecteur compact (une valeur) — ouvre un sheet, pas un mur de chips. */
export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  allLabel = "Tous",
}: {
  label: string;
  value: string;
  options: FilterDropdownOption[];
  onChange: (next: string) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const display = selected?.hint ?? selected?.label ?? label;

  const pick = (next: string) => {
    Haptics.selectionAsync();
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="min-h-[44px] flex-1 flex-row items-center justify-between gap-1 border border-border bg-bg-elevated px-2.5 py-2"
        style={{ borderRadius: cpcTokens.radius.control }}
      >
        <Text numberOfLines={1} className={cn("flex-1 text-xs font-bold", value ? "text-fg" : "text-fg-muted")}>
          {display}
        </Text>
        <ChevronDown size={14} color={cpcHex.textMuted} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View className="gap-1.5 pb-2">
          <Pressable
            onPress={() => pick("")}
            className={`min-h-[44px] justify-center px-4 py-3 ${value === "" ? "bg-bg-card" : "bg-bg-elevated"}`}
            style={{ borderRadius: cpcTokens.radius.control }}
          >
            <Text className={`font-semibold ${value === "" ? "text-fg" : "text-fg-muted"}`}>{allLabel}</Text>
          </Pressable>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => pick(opt.value)}
                className={`min-h-[44px] justify-center px-4 py-3 ${active ? "bg-bg-card" : "bg-bg-elevated"}`}
                style={{ borderRadius: cpcTokens.radius.control }}
              >
                <Text className={`font-semibold ${active ? "text-fg" : "text-fg-muted"}`}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}
