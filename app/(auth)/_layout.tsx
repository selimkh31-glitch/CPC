import { Stack } from "expo-router";
import { cpcHex } from "@/lib/design/cpc-native";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cpcHex.background } }} />;
}
