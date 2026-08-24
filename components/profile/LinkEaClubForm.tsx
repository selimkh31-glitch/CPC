import { useState } from "react";
import { View, Text } from "react-native";
import { BadgeCheck } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useLinkEaClub } from "@/lib/hooks/useProfile";
import { toast } from "@/lib/toast";

/** Lien vers le club EA SPORTS FC (stats affichées seulement si liées). */
export function LinkEaClubForm() {
  const [eaClubName, setEaClubName] = useState("");
  const mutation = useLinkEaClub();

  const link = () => {
    if (!eaClubName.trim()) return;
    mutation.mutate(eaClubName.trim(), {
      onSuccess: (data) => toast.success(data.synced ? "Club EA lié et stats synchronisées !" : "Club EA lié. Stats en attente de sync."),
      onError: (err: any) => toast.error(err.message ?? "L'API EA est peut-être indisponible, réessaie plus tard."),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<BadgeCheck size={18} color="#39ff8a" />}>Stats EA liées</CardTitle>
      </CardHeader>
      <Text className="mb-3 text-sm text-fg-muted">
        Lie ton club EA SPORTS FC pour afficher tes vraies stats sur ta ClubPro Card.
      </Text>
      <View className="flex-row gap-2">
        <Input
          className="flex-1"
          value={eaClubName}
          onChangeText={setEaClubName}
          placeholder="Nom exact de ton club EA"
        />
        <Button loading={mutation.isPending} onPress={link}>
          Lier
        </Button>
      </View>
      <Text className="mt-2 text-xs text-fg-subtle">
        Basé sur des endpoints EA non-officiels : peut être temporairement indisponible.
      </Text>
    </Card>
  );
}
