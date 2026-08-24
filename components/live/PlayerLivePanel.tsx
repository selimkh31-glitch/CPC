import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Radio } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PulseDot } from "@/components/ui/PulseDot";
import { Sheet } from "@/components/ui/Sheet";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { DEFAULT_LIVE_DURATION_MS, LIVE_DURATION_OPTIONS, isLiveActive, parseLiveDurationMs } from "@/lib/live";
import { PLATFORM_LABELS, POSITION_LABELS } from "@/lib/constants";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useGoPlayerLive, useGoPlayerOffline, useMyPlayerSession } from "@/lib/hooks/usePlayerLive";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * P0 — le joueur se déclare dispo maintenant pour un roster FC 27 Pro Clubs.
 * Distinct de la présence in-app. TTL obligatoire.
 * OFF : carte compacte. ON : statut compact (le formulaire n'est plus ouvert).
 */
export function PlayerLivePanel() {
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? null;
  const { data: mySession, isLoading, isError, refetch } = useMyPlayerSession(userId);
  const goLive = useGoPlayerLive(userId);
  const goOffline = useGoPlayerOffline(userId);
  const [note, setNote] = useState("");
  const [duration, setDuration] = useState(String(DEFAULT_LIVE_DURATION_MS));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const now = useLiveClock();
  const live = isLiveActive(mySession, now);

  const positionLabel = profile?.main_position ? POSITION_LABELS[profile.main_position] : "Poste du profil";
  const platformLabel = profile?.platform ? PLATFORM_LABELS[profile.platform] : "Plateforme du profil";

  const start = () => {
    if (goLive.isPending) return;
    goLive.mutate(
      { note: note.trim() || undefined, durationMs: parseLiveDurationMs(duration) },
      {
        onSuccess: () => {
          toast.success("Tu es LIVE — visible pour les clubs qui recrutent.");
          setSheetOpen(false);
          setShowMore(false);
        },
        onError: (err: any) => toast.error(err.message ?? "Impossible de passer LIVE."),
      }
    );
  };

  const stop = () => {
    if (!mySession) return;
    goOffline.mutate(mySession.id, { onSuccess: () => toast.info("LIVE joueur terminé.") });
  };

  const openSheet = () => {
    if (mySession?.note) setNote(mySession.note);
    setSheetOpen(true);
  };

  return (
    <Card className={cn("mb-3 p-3.5", live && "border-accent/40 bg-accent/10")}>
      {isLoading ? (
        <Skeleton className="h-16" />
      ) : isError ? (
        <ErrorState message="Impossible de charger ton LIVE." onRetry={refetch} />
      ) : live ? (
        <>
          <View className="mb-1 flex-row items-start gap-2">
            <PulseDot />
            <Text className="flex-1 font-display text-lg text-fg">Tu es LIVE</Text>
            <LiveCountdown expiresAt={mySession?.expires_at ?? null} />
          </View>
          <Text className="text-sm text-fg-muted">Les clubs peuvent te trouver.</Text>
          <Text className="mt-2 text-xs font-semibold text-fg">
            {positionLabel} · {platformLabel}
          </Text>
          <View className="mt-3 flex-row gap-2">
            <Button size="sm" variant="secondary" onPress={openSheet} className="flex-1">
              Modifier
            </Button>
            <Button size="sm" variant="danger" loading={goOffline.isPending} onPress={stop} className="flex-1">
              Quitter le LIVE
            </Button>
          </View>
        </>
      ) : (
        <>
          <View className="mb-1 flex-row items-start gap-2">
            <Radio size={16} color="#9aa0a8" />
            <Text className="flex-1 font-display text-lg text-fg">Tu cherches un club maintenant ?</Text>
          </View>
          <Text className="mb-3 text-sm text-fg-muted">Passe LIVE et laisse les clubs te trouver.</Text>
          <Button loading={goLive.isPending} onPress={openSheet}>
            PASSER LIVE
          </Button>
          <Pressable
            onPress={() => setShowDetails((v) => !v)}
            className="mt-2 min-h-[44px] items-center justify-center py-1"
            accessibilityRole="button"
          >
            <Text className="text-xs font-semibold text-fg-subtle">Détails</Text>
          </Pressable>
          {showDetails ? (
            <Text className="text-[11px] leading-4 text-fg-subtle">
              Les clubs te voient avec ton poste et ta plateforme (profil). Tu choisis seulement la
              durée — le LIVE expire tout seul.
            </Text>
          ) : null}
        </>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={live ? "Modifier le LIVE" : "Passer LIVE"}
      >
        <Text className="mb-3 text-sm text-fg-muted">
          Visible tout de suite pour les clubs qui recrutent. Expire tout seul.
        </Text>

        <View className="mb-3 gap-2">
          <InfoRow label="Poste" value={positionLabel} />
          <InfoRow label="Plateforme" value={platformLabel} />
        </View>
        <Text className="mb-3 text-[11px] text-fg-subtle">
          Poste et plateforme viennent de ton profil — le matching LIVE s&apos;appuie dessus.
        </Text>

        <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Durée</Text>
        <View className="mb-3 flex-row rounded-2xl border border-border bg-bg-elevated p-1">
          {LIVE_DURATION_OPTIONS.map((opt) => {
            const active = duration === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setDuration(opt.value)}
                className={`min-h-[44px] flex-1 justify-center rounded-xl px-2 py-2 ${active ? "bg-accent" : ""}`}
              >
                <Text className={`text-center text-sm font-bold ${active ? "text-bg" : "text-fg-muted"}`}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setShowMore((v) => !v)}
          className="mb-2 min-h-[44px] justify-center py-1"
          accessibilityRole="button"
        >
          <Text className="text-xs font-semibold text-fg-subtle">
            {showMore ? "Masquer la note" : "Note (optionnel)"}
          </Text>
        </Pressable>
        {showMore ? (
          <View className="mb-3">
            <Input
              value={note}
              onChangeText={setNote}
              placeholder="Ex : ST dispo ce soir"
              maxLength={200}
            />
          </View>
        ) : null}

        <Button loading={goLive.isPending} onPress={start}>
          {live ? "Mettre à jour" : "PASSER LIVE"}
        </Button>
      </Sheet>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between rounded-xl bg-bg-elevated px-3 py-2.5">
      <Text className="text-xs text-fg-subtle">{label}</Text>
      <Text className="text-sm font-bold text-fg">{value}</Text>
    </View>
  );
}
