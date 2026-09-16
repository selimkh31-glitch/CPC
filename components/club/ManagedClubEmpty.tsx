import type { ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { EmptyState } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";

/** 0 clubs gérés — empty honnête + créer. Pas une ErrorState. */
export function ManagedClubEmpty({ extras }: { extras?: ReactNode }) {
  return (
    <View className="gap-4">
      <EmptyState
        title="Aucun club géré"
        subtitle="Crée un club, ou fais-toi nommer manager."
      />
      <Button className="min-h-[48px]" onPress={() => router.push("/create-club")}>
        Créer un club
      </Button>
      {extras}
    </View>
  );
}
