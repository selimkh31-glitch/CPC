import type { ReactNode } from "react";
import { Modal, Pressable, Text, View, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

/**
 * Bottom sheet natif (Modal RN) — pas de nouvelle dépendance.
 * Même pattern que FormationSelector.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const maxHeight = Math.round(Dimensions.get("window").height * 0.72);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
          <View
            className="rounded-t-3xl border-t border-border bg-bg-card"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="items-center pt-2">
              <View className="h-1 w-10 rounded-full bg-border" />
            </View>
            <View className="flex-row items-center justify-between px-4 py-3">
              <Text className="font-display text-lg text-fg">{title}</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
                <X size={20} color="#9aa0a8" />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
