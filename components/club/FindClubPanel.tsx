import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { ClubMatchmaking } from "@/components/club/ClubMatchmaking";
import { ClubsDirectory } from "@/components/club/ClubsDirectory";

/**
 * Trouver un club — matchmaking + annuaire, extraits de l'ancien onglet Clubs.
 * Vit désormais dans l'onglet LIVE joueur (pas un tab séparé).
 */
export function FindClubPanel() {
  const [directoryTab, setDirectoryTab] = useState<"matchmaking" | "directory">("matchmaking");

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 pt-2">
        <View className="flex-row rounded-2xl border border-border bg-bg-elevated p-1">
          <Pressable
            onPress={() => setDirectoryTab("matchmaking")}
            className={`rounded-xl px-3 py-2 ${directoryTab === "matchmaking" ? "bg-accent" : ""}`}
          >
            <Text className={`text-sm font-bold ${directoryTab === "matchmaking" ? "text-bg" : "text-fg-muted"}`}>Pour toi</Text>
          </Pressable>
          <Pressable
            onPress={() => setDirectoryTab("directory")}
            className={`rounded-xl px-3 py-2 ${directoryTab === "directory" ? "bg-accent" : ""}`}
          >
            <Text className={`text-sm font-bold ${directoryTab === "directory" ? "text-bg" : "text-fg-muted"}`}>Tous les clubs</Text>
          </Pressable>
        </View>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus size={16} color="#f4f5f7" />}
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/create-club");
          }}
        >
          Créer
        </Button>
      </View>

      {directoryTab === "matchmaking" ? <ClubMatchmaking compact /> : <ClubsDirectory hideTitle />}
    </View>
  );
}
