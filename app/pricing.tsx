import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Crown } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FEATURE_REVENUECAT, pricingScreenCopy, proPurchaseCta } from "@/lib/constants";
import { purchasePro } from "@/lib/revenuecat";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";

/** Paywall Pro — achat in-app seulement si RevenueCat est réellement branché. */
export default function PricingScreen() {
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const purchase = proPurchaseCta(FEATURE_REVENUECAT);
  const copy = pricingScreenCopy(FEATURE_REVENUECAT);

  const upgrade = async () => {
    if (!purchase.canPurchase) return;
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
      <Text className="text-center text-fg-muted">{copy.intro}</Text>

      <View className="mt-6">
        <Card className={purchase.canPurchase ? "border-pro/50 bg-pro/5" : undefined}>
          <View className="flex-row items-center gap-2">
            <Crown size={18} color={purchase.canPurchase ? "#ae8bff" : "#9aa0a8"} />
            <Text className={`font-display text-xl ${purchase.canPurchase ? "text-pro-200" : "text-fg"}`}>
              Pro
            </Text>
          </View>
          {copy.priceLabel ? (
            <Text className="mt-1 text-2xl font-extrabold text-fg">{copy.priceLabel}</Text>
          ) : (
            <Text className="mt-1 text-base text-fg-muted">Aucun tarif affiché — pas encore à vendre.</Text>
          )}
          {copy.liveFeatures.length > 0 ? (
            <View className="mt-4 gap-2">
              {copy.liveFeatures.map((f) => (
                <Text key={f} className="text-sm text-fg">
                  {f}
                </Text>
              ))}
            </View>
          ) : null}
          <View className="mt-4 gap-2">
            <Text className="text-xs font-bold uppercase tracking-wide text-fg-muted">{copy.laterHeading}</Text>
            {copy.laterFeatures.map((f) => (
              <Text key={f} className="text-sm text-fg-muted">
                {f} — bientôt
              </Text>
            ))}
          </View>
          <View className="mt-5">
            {purchase.disabledReason ? (
              <Text className="mb-3 text-center text-sm text-fg-muted">{purchase.disabledReason}</Text>
            ) : null}
            <Button
              variant={purchase.canPurchase ? "pro" : "secondary"}
              loading={loading}
              disabled={!purchase.canPurchase}
              onPress={upgrade}
            >
              {copy.ctaLabel}
            </Button>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
