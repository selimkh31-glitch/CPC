import { Linking, Text, View } from "react-native";
import { Mic } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";

/**
 * Bloc vocal du club — lecture + ouverture. L'édition du lien (owner) vit
 * dans `/edit-club`. Aucune hypothèse sur le format de l'URL (Party
 * PlayStation ou autre) : ouverture via le mécanisme de liens natif tel
 * quel, sans validation de plateforme.
 */
export function VoiceLinkBlock({ voiceLink }: { voiceLink: string | null }) {
  if (!voiceLink) return null;

  const join = async () => {
    try {
      await Linking.openURL(voiceLink);
    } catch {
      toast.error("Impossible d'ouvrir ce lien.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Mic size={18} color="#f4f5f7" />}>Vocal du club</CardTitle>
      </CardHeader>
      <View className="gap-3">
        <Text numberOfLines={1} className="text-sm text-fg-muted">
          {voiceLink}
        </Text>
        <Button icon={<Mic size={16} color="#08090b" />} onPress={join}>
          Rejoindre le vocal
        </Button>
      </View>
    </Card>
  );
}
