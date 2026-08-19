import { Text } from "react-native";
import { AnimatePresence, MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToastItems, type ToastItem } from "@/lib/toast";
import { cn } from "@/lib/utils";

const BORDER_CLASSES: Record<ToastItem["type"], string> = {
  success: "border-accent/40",
  error: "border-danger/40",
  info: "border-border",
};

/** Overlay de toasts — monté une seule fois au niveau racine (voir app/_layout.tsx). */
export function ToastHost() {
  const items = useToastItems();
  const insets = useSafeAreaInsets();

  return (
    <MotiView
      pointerEvents="none"
      style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, zIndex: 100, gap: 8 }}
    >
      <AnimatePresence>
        {items.map((item) => (
          <MotiView
            key={item.id}
            from={{ opacity: 0, translateY: -12 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -12 }}
            className={cn("rounded-2xl border bg-bg-elevated px-4 py-3", BORDER_CLASSES[item.type])}
          >
            <Text className="text-sm font-semibold text-fg">{item.message}</Text>
          </MotiView>
        ))}
      </AnimatePresence>
    </MotiView>
  );
}
