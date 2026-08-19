import { Slot } from "expo-router";

/**
 * Foundation #1 — passthrough vers (tabs), même pattern que app/(auth)/_layout.tsx.
 * Ce groupe existe uniquement pour que "(player)" soit adressable comme
 * Stack.Screen distinct de "(club)" dans app/_layout.tsx (Stack.Protected sur
 * `mode`). Aucune logique ici.
 */
export default function PlayerLayout() {
  return <Slot />;
}
