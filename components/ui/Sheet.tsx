import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

type SheetEntry = { id: symbol; close: () => void };

/** Pile des sheets visibles — le back Android ne ferme que le sommet. */
const sheetStack: SheetEntry[] = [];

/**
 * Bottom sheet natif (Modal RN) — pas de nouvelle dépendance.
 * iOS : KeyboardAvoidingView `padding`, offset 0 (Modal plein écran, pas de header).
 * Android : `height` — un Modal `transparent` n'hérite pas de windowSoftInputMode.
 * onRequestClose = sommet de pile uniquement.
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
  const windowCap = Math.round(Dimensions.get("window").height * 0.72);
  const [areaH, setAreaH] = useState(Dimensions.get("window").height);
  const padBottom = Math.max(insets.bottom, 16);
  const sheetChrome = 72 + padBottom;
  const maxHeight = Math.max(96, Math.min(windowCap, Math.round(areaH) - sheetChrome));
  const idRef = useRef(Symbol("sheet"));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible) return;
    const id = idRef.current;
    const entry: SheetEntry = { id, close: () => onCloseRef.current() };
    sheetStack.push(entry);
    return () => {
      const i = sheetStack.findIndex((s) => s.id === id);
      if (i >= 0) sheetStack.splice(i, 1);
    };
  }, [visible]);

  const handleRequestClose = () => {
    const top = sheetStack[sheetStack.length - 1];
    if (top?.id === idRef.current) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleRequestClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
        className="flex-1"
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: cpcHex.overlay }}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            setAreaH((prev) => (prev === h ? prev : h));
          }}
        >
          <Pressable className="flex-1" onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
          <View className="border-t border-border bg-bg-card" style={{ paddingBottom: padBottom, borderTopLeftRadius: cpcTokens.radius.sheet, borderTopRightRadius: cpcTokens.radius.sheet }}>
            <View className="items-center pt-2">
              <View className="h-1 w-10 rounded-full bg-border" />
            </View>
            <View className="flex-row items-center justify-between px-4 py-3">
              <Text className="font-display text-lg text-fg">{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                className="min-h-[44px] min-w-[44px] items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Fermer"
              >
                <X size={cpcTokens.icon.md} color={cpcHex.textMuted} />
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
