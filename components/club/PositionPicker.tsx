import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Check, ChevronDown, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { POSITIONS, POSITION_LABELS } from "@/lib/constants";
import { formatNeededPositionsLine } from "@/lib/sessionState";

/**
 * Multi-sélection de postes en une ligne + feuille — pas un mur de chips.
 * Liste 44 pt, même pattern modal que FormationSelector.
 */
export function PositionPicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Choisir les postes recherchés",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const summary = formatNeededPositionsLine(value);

  const toggle = (code: string) => {
    Haptics.selectionAsync();
    if (value.includes(code)) {
      onChange(value.filter((x) => x !== code));
    } else {
      onChange([...value, code]);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary ?? placeholder}
        disabled={disabled}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen(true);
        }}
        className="min-h-[44px] flex-row items-center justify-between gap-2 rounded-xl border border-border bg-bg-elevated px-3 active:opacity-80"
      >
        <Text numberOfLines={2} className={`flex-1 text-sm font-semibold ${summary ? "text-fg" : "text-fg-muted"}`}>
          {summary ?? placeholder}
        </Text>
        <ChevronDown size={16} color="#9aa0a8" />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[80%] rounded-t-3xl border-t border-border bg-bg-card px-4 pb-8 pt-4" onPress={() => {}}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-display text-lg uppercase tracking-wide text-fg">Postes recherchés</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={() => setOpen(false)}
                className="h-11 w-11 items-center justify-center"
              >
                <X size={20} color="#9aa0a8" />
              </Pressable>
            </View>
            <ScrollView className="max-h-[70%]" keyboardShouldPersistTaps="handled">
              <View className="gap-1">
                {POSITIONS.map((code) => {
                  const selected = value.includes(code);
                  return (
                    <Pressable
                      key={code}
                      onPress={() => toggle(code)}
                      className={`min-h-[44px] flex-row items-center justify-between rounded-xl px-4 active:opacity-80 ${
                        selected ? "bg-accent/15" : "bg-bg-elevated"
                      }`}
                    >
                      <Text className={`font-semibold ${selected ? "text-accent" : "text-fg"}`}>
                        {code} · {POSITION_LABELS[code]}
                      </Text>
                      {selected ? <Check size={18} color="#39ff8a" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
