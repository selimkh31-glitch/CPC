import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Check, Crown } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FEATURE_REVENUECAT, FREE_APPLICATIONS_PER_DAY, PRO_PRICE_EUR } from "@/lib/constants";
import { purchasePro } from "@/lib/revenuecat";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";

const FREE_FEATURES = [
  "Profil de base",
  "Voir le Live Feed",
  `${FREE_APPLICATIONS_PER_DAY} candidatures / jour`,
  "ClubPro Card basique",
];

const PRO_FEATURES = [
  "Candidatures illimitées",
  "Carte animée premium + raretés",
  "Filtres avancés",
  "Priorité dans les candidatures",
  "Scout Report IA",
  "Saison CPC",
  "Badges de saison",
  "Stats EA liées",
];

/** Paywall Pro (section 6) — achat in-app via RevenueCat (StoreKit / Play Billing). */
export default function PricingScreen() {
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const upgrade = async () => {
    if (!FEATURE_REVENUECAT) {
      toast.info("Paiement in-app pas encore configuré sur cet environnement (voir README).");
      return;
    }
    setLoading(true);
    try {
      const isPro = await purchasePro("pro_monthly");
      if (isPro) {
        toast.success("Bienvenue dans Pro ! 🎉");
        await refreshProfile();
      }
    } catch (err: any) {
      toast.error(err.message ?? "Achat annulé ou échoué.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Text className="text-center text-fg-muted">
        Une identité compétitive vérifiée, sans limites. {PRO_PRICE_EUR}€/mois, annulable à tout moment.
      </Text>

      <View className="mt-6 gap-4">
        <Card>
          <Text className="font-display text-xl text-fg">Free</Text>
          <Text className="mt-1 text-2xl font-extrabold text-fg">0€</Text>
          <View className="mt-4 gap-2">
            {FREE_FEATURES.map((f) => (
              <View key={f} className="flex-row items-center gap-2">
                <Check size={15} color="#666c74" />
                <Text className="text-sm text-fg-muted">{f}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card className="border-pro/50 bg-pro/5">
          <View className="flex-row items-center gap-2">
            <Crown size={18} color="#ae8bff" />
            <Text className="font-display text-xl text-pro-200">Pro</Text>
          </View>
          <Text className="mt-1 text-2xl font-extrabold text-fg">{PRO_PRICE_EUR}€ / mois</Text>
          <View className="mt-4 gap-2">
            {PRO_FEATURES.map((f) => (
              <View key={f} className="flex-row items-center gap-2">
                <Check size={15} color="#ae8bff" />
                <Text className="text-sm text-fg">{f}</Text>
              </View>
            ))}
          </View>
          <View className="mt-5">
            <Button variant="pro" loading={loading} onPress={upgrade}>
              Passer Pro
            </Button>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
