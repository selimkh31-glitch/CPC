import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useScoutReport } from "@/lib/hooks/useProfile";
import { toast } from "@/lib/toast";
import { FEATURE_REVENUECAT } from "@/lib/constants";

/** Scout Report IA — pas un produit vendable tant que RevenueCat est off. */
export function ScoutReportPanel({ isPro }: { isPro: boolean }) {
  const mutation = useScoutReport();
  const report = mutation.data?.report;

  if (!FEATURE_REVENUECAT) {
    return (
      <Card>
        <CardHeader>
          <CardTitle icon={<Sparkles size={18} color="#9aa0a8" />}>Scout Report IA</CardTitle>
        </CardHeader>
        <Text className="text-sm text-fg-muted">Bientôt — pas encore dans le produit, pas à vendre.</Text>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Sparkles size={18} color="#ae8bff" />}>Scout Report IA</CardTitle>
      </CardHeader>
      {!isPro ? (
        <Text className="text-sm text-fg-muted">Bientôt — pas encore dans le produit.</Text>
      ) : report ? (
        <View className="gap-2">
          <Text className="text-sm text-fg">{report.summary}</Text>
          <View>
            <Text className="text-xs font-extrabold uppercase text-fg-muted">Points forts</Text>
            {report.strengths.map((s) => (
              <Text key={s} className="text-sm text-fg-muted">
                • {s}
              </Text>
            ))}
          </View>
          <View>
            <Text className="text-xs font-extrabold uppercase text-fg-muted">À travailler</Text>
            {report.to_improve.map((s) => (
              <Text key={s} className="text-sm text-fg-muted">
                • {s}
              </Text>
            ))}
          </View>
        </View>
      ) : (
        <Button
          variant="pro"
          loading={mutation.isPending}
          onPress={() => mutation.mutate(undefined, { onError: (err: any) => toast.error(err.message ?? "Erreur") })}
        >
          Générer mon Scout Report
        </Button>
      )}
    </Card>
  );
}
