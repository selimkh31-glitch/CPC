import { useState } from "react";
import { Text, View } from "react-native";
import { Radio } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { PulseDot } from "@/components/ui/PulseDot";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { DEFAULT_LIVE_DURATION_MS, LIVE_DURATION_OPTIONS, isLiveActive, parseLiveDurationMs } from "@/lib/live";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useGoPlayerLive, useGoPlayerOffline, useMyPlayerSession } from "@/lib/hooks/usePlayerLive";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { toast } from "@/lib/toast";

/**
 * P0 — le joueur se déclare dispo maintenant pour un roster FC 27 Pro Clubs.
 * Distinct de la présence in-app. TTL obligatoire.
 */
export function PlayerLivePanel() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { data: mySession, isLoading, isError, refetch } = useMyPlayerSession(userId);
  const goLive = useGoPlayerLive(userId);
  const goOffline = useGoPlayerOffline(userId);
  const [note, setNote] = useState("");
  const [duration, setDuration] = useState([String(DEFAULT_LIVE_DURATION_MS)]);
  const now = useLiveClock();
  const live = isLiveActive(mySession, now);

  const start = () => {
    if (goLive.isPending) return;
    goLive.mutate(
      { note: note.trim() || undefined, durationMs: parseLiveDurationMs(duration[0]) },
      {
        onSuccess: () => toast.success("Tu es LIVE — visible pour les clubs qui recrutent."),
        onError: (err: any) => toast.error(err.message ?? "Impossible de passer LIVE."),
      }
    );
  };

  const stop = () => {
    if (!mySession) return;
    goOffline.mutate(mySession.id, { onSuccess: () => toast.info("LIVE joueur terminé.") });
  };

  return (
    <Card className="mb-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Radio size={16} color={live ? "#39ff8a" : "#9aa0a8"} />
          <Text className="font-display text-lg text-fg">Mon LIVE joueur</Text>
        </View>
        {live && (
          <View className="flex-row items-center gap-1.5">
            <PulseDot />
            <LiveCountdown expiresAt={mySession?.expires_at ?? null} />
          </View>
        )}
      </View>
      <Text className="mb-3 text-xs text-fg-muted">
        Signale que tu cherches un club EA SPORTS FC 27 Pro Clubs maintenant. Expire tout seul.
      </Text>
      {isLoading ? (
        <Skeleton className="h-16" />
      ) : isError ? (
        <ErrorState message="Impossible de charger ton LIVE." onRetry={refetch} />
      ) : (
        <>
          {!live && (
            <>
              <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Durée</Text>
              <ChipSelect single value={duration} onChange={(v) => setDuration(v.length ? v : [String(DEFAULT_LIVE_DURATION_MS)])} options={[...LIVE_DURATION_OPTIONS]} />
              <View className="mt-3">
                <Input value={note} onChangeText={setNote} placeholder="Note (optionnel) — ex: ST dispo ce soir" maxLength={200} />
              </View>
            </>
          )}
          <View className="mt-3">
            {live ? (
              <Button variant="danger" loading={goOffline.isPending} onPress={stop}>
                Passer OFFLINE
              </Button>
            ) : (
              <Button loading={goLive.isPending} onPress={start}>
                Passer LIVE
              </Button>
            )}
          </View>
        </>
      )}
    </Card>
  );
}
