import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PulseDot } from "@/components/ui/PulseDot";
import { Sheet } from "@/components/ui/Sheet";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import {
  LIVE_DURATION_OPTIONS,
  LIVE_UX_COPY,
  isLiveActive,
  liveSessionDurationMs,
  parseLiveDurationMs,
} from "@/lib/live";
import { PLATFORM_LABELS, POSITION_LABELS } from "@/lib/constants";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useGoPlayerLive, useGoPlayerOffline, useMyPlayerSession } from "@/lib/hooks/usePlayerLive";
import { useLiveClock } from "@/lib/hooks/useLiveClock";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * LIVE joueur — un état (off / open). Matching / TTL inchangés.
 * Unmount / signOut / switch compte ne coupent PAS le LIVE : seul Arrêter
 * (`stop`) écrit `is_live: false`.
 */
export function PlayerLivePanel() {
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? null;
  const { data: mySession, isLoading, isError, refetch } = useMyPlayerSession(userId);
  const goLive = useGoPlayerLive(userId);
  const goOffline = useGoPlayerOffline(userId);
  const [note, setNote] = useState("");
  const [duration, setDuration] = useState(String(liveSessionDurationMs()));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const now = useLiveClock();
  const live = isLiveActive(mySession, now);

  const positionLabel = profile?.main_position ? POSITION_LABELS[profile.main_position] : "Poste du profil";
  const platformLabel = profile?.platform ? PLATFORM_LABELS[profile.platform] : "Plateforme du profil";

  const start = () => {
    if (goLive.isPending) return;
    goLive.mutate(
      {
        note: note.trim() || undefined,
        durationMs: __DEV__ ? liveSessionDurationMs() : parseLiveDurationMs(duration),
      },
      {
        onSuccess: () => {
          toast.success("C'est parti. Les clubs te voient.");
          setSheetOpen(false);
          setShowMore(false);
        },
        onError: (err: any) => toast.error(err.message ?? "Impossible de passer LIVE."),
      }
    );
  };

  const stop = () => {
    if (!mySession) return;
    goOffline.mutate(mySession.id, { onSuccess: () => toast.info("C'est coupé.") });
  };

  const openSheet = () => {
    if (mySession?.note) setNote(mySession.note);
    setSheetOpen(true);
  };

  return (
    <Card className={cn("mb-5 rounded-[28px] p-6", live && "border-accent/35 bg-accent/8")}>
      {isLoading && !mySession ? (
        <Skeleton className="h-16" />
      ) : live ? (
        <>
          <View className="mb-2 flex-row items-start gap-2">
            <PulseDot />
            <Text className="flex-1 font-display text-2xl text-fg">{LIVE_UX_COPY.playerHeadline}</Text>
          </View>
          <Text className="text-sm text-fg-muted">{LIVE_UX_COPY.stillLooking}</Text>
          <Text className="mt-3 text-base font-semibold text-fg">
            {positionLabel} · {platformLabel}
          </Text>
          <LiveCountdown expiresAt={mySession?.expires_at ?? null} className="mt-2 text-sm" />
          {mySession?.note ? <Text className="mt-2 text-sm text-fg-muted">{mySession.note}</Text> : null}
          <Pressable onPress={openSheet} className="mt-4 min-h-[44px] justify-center" accessibilityRole="button">
            <Text className="text-sm text-fg-subtle">{LIVE_UX_COPY.edit}</Text>
          </Pressable>
          <Button variant="ghost" className="mt-1 min-h-[44px]" loading={goOffline.isPending} onPress={stop}>
            {LIVE_UX_COPY.stop}
          </Button>
        </>
      ) : isError ? (
        <ErrorState message="Impossible de charger ton LIVE." onRetry={refetch} />
      ) : (
        <>
          <Text className="font-display text-2xl text-fg">{LIVE_UX_COPY.playerHeadline}</Text>
          <Text className="mb-5 mt-2 text-sm text-fg-muted">Passe LIVE. Les clubs te voient tout de suite.</Text>
          <Button size="lg" loading={goLive.isPending} onPress={openSheet}>
            {LIVE_UX_COPY.goLive}
          </Button>
        </>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={live ? LIVE_UX_COPY.edit : LIVE_UX_COPY.goLive}
      >
        <View className="mb-4 gap-2">
          <InfoRow label="Poste" value={positionLabel} />
          <InfoRow label="Plateforme" value={platformLabel} />
        </View>

        {__DEV__ ? null : (
          <>
            <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">
              {LIVE_UX_COPY.howLong}
            </Text>
            <View className="mb-4 flex-row rounded-2xl border border-border bg-bg-elevated p-1">
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
          </>
        )}

        <Pressable
          onPress={() => setShowMore((v) => !v)}
          className="mb-2 min-h-[44px] justify-center py-1"
          accessibilityRole="button"
        >
          <Text className="text-sm text-fg-subtle">{showMore ? LIVE_UX_COPY.hideNote : LIVE_UX_COPY.noteOptional}</Text>
        </Pressable>
        {showMore ? (
          <View className="mb-4">
            <Input value={note} onChangeText={setNote} placeholder="Ex : ST dispo ce soir" maxLength={200} />
          </View>
        ) : null}

        <Button loading={goLive.isPending} onPress={start}>
          {live ? "C'est bon" : LIVE_UX_COPY.goLive}
        </Button>
      </Sheet>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-[44px] flex-row items-center justify-between rounded-xl bg-bg-elevated px-3 py-2.5">
      <Text className="text-xs text-fg-subtle">{label}</Text>
      <Text className="text-sm font-bold text-fg">{value}</Text>
    </View>
  );
}
