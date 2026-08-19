import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { LogOut, Mail } from "lucide-react-native";
import { useClubDepartures } from "@/lib/hooks/useDepartures";
import { useApplications } from "@/lib/hooks/useApplications";

/**
 * Cockpit — "MATCH CONTEXT" (Phase G.3.2, audit G.3.1 section F). Surface
 * glanceable, PAS un doublon de DeparturesPanel/ApplicationsPanel (qui
 * restent l'outil complet sur EFFECTIF/CANDIDATURES) — juste un compteur
 * actionnable pour que le manager ne rate pas un événement pendant le match
 * (scénario P0 : un départ signalé en pleine mi-temps). Hooks EXISTANTS,
 * non modifiés, déjà réactifs en temps réel (abonnement Supabase Realtime
 * sur club_departures/applications, voir lib/hooks/useDepartures.ts et
 * useApplications.ts) — aucune nouvelle donnée, aucun polling ajouté.
 */
export function MatchContextCards({ clubId }: { clubId: string }) {
  const { data: departures } = useClubDepartures(clubId);
  const { data: applications } = useApplications(clubId);

  const pendingDepartures = departures?.length ?? 0;
  const pendingApplications = (applications ?? []).filter((a) => a.status === "PENDING").length;

  if (pendingDepartures === 0 && pendingApplications === 0) return null;

  return (
    <View className="gap-2">
      {pendingDepartures > 0 && (
        <ContextRow
          icon={<LogOut size={16} color="#f5a623" />}
          label={`${pendingDepartures} départ${pendingDepartures > 1 ? "s" : ""} à traiter`}
          onPress={() => router.push("/effectif")}
        />
      )}
      {pendingApplications > 0 && (
        <ContextRow
          icon={<Mail size={16} color="#39ff8a" />}
          label={`${pendingApplications} candidature${pendingApplications > 1 ? "s" : ""} en attente`}
          onPress={() => router.push("/candidatures")}
        />
      )}
    </View>
  );
}

function ContextRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      className="flex-row items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2.5 active:opacity-70"
    >
      {icon}
      <Text className="flex-1 text-sm font-semibold text-fg">{label}</Text>
    </Pressable>
  );
}
