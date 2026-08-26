import { useEffect, useRef } from "react";
import { Switch, Text, View } from "react-native";
import { PulseDot } from "@/components/ui/PulseDot";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { LIVE_UX_COPY, liveSessionDurationMs } from "@/lib/live";
import { useCreateSession, usePatchLiveNeededPositions, useToggleSession } from "@/lib/hooks/useClubs";
import { toast } from "@/lib/toast";

/**
 * Découverte club — un ON/OFF. TTL silencieux (2 h prod / 12 h DEV, expires_at obligatoire).
 * needed_positions = postes vides du terrain, pas un sheet de postes.
 * Seul le toggle OFF (et le TTL) coupe le LIVE — pas un unmount, pas un pitch [] au hydrate.
 */
export function ClubDiscoveryToggle({
  clubId,
  activeSession,
  neededPositions,
  canManage,
  pitchReady = true,
}: {
  clubId: string;
  activeSession: { id: string; needed_positions: string[]; expires_at?: string | null } | null;
  neededPositions: string[];
  canManage: boolean;
  pitchReady?: boolean;
}) {
  const createSession = useCreateSession(clubId);
  const toggleSession = useToggleSession(clubId);
  const patchPositions = usePatchLiveNeededPositions(clubId);
  const live = Boolean(activeSession);
  const pending = createSession.isPending || toggleSession.isPending || patchPositions.isPending;
  const neededKey = neededPositions.join(",");
  const liveKey = activeSession?.needed_positions.join(",") ?? "";
  const sessionId = activeSession?.id ?? null;
  const syncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canManage || !sessionId || !live) return;
    const key = `${sessionId}:${neededKey}`;
    if (syncedKeyRef.current === key) return;

    if (neededPositions.length === 0) {
      if (__DEV__) return;
      if (!pitchReady) return;
      syncedKeyRef.current = key;
      toggleSession.mutate(
        { sessionId, isLive: true },
        {
          onSuccess: () => toast.info(LIVE_UX_COPY.discoveryFull),
          onError: (err: unknown) => {
            syncedKeyRef.current = null;
            const message = err instanceof Error ? err.message : "Impossible de couper.";
            toast.error(message);
          },
        }
      );
      return;
    }

    if (neededKey === liveKey) {
      syncedKeyRef.current = key;
      return;
    }

    syncedKeyRef.current = key;
    patchPositions.mutate(
      { sessionId, neededPositions },
      {
        onError: (err: unknown) => {
          syncedKeyRef.current = null;
          const message = err instanceof Error ? err.message : "Impossible de mettre à jour les postes.";
          toast.error(message);
        },
      }
    );
    // Vacancies only — never write is_live false from a cleanup / unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, live, sessionId, neededKey, liveKey, pitchReady]);

  const emptyToast = () => {
    toast.error(pitchReady ? LIVE_UX_COPY.discoveryFull : LIVE_UX_COPY.discoveryNeedPitch);
  };

  const turnOn = () => {
    if (!canManage || pending) return;
    if (neededPositions.length === 0) {
      emptyToast();
      return;
    }
    createSession.mutate(
      { neededPositions, durationMs: liveSessionDurationMs() },
      {
        onSuccess: () => toast.success(`${LIVE_UX_COPY.discoveryOn}. ${LIVE_UX_COPY.discoveryHintOn}.`),
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Impossible de passer en ligne.";
          toast.error(message);
        },
      }
    );
  };

  const turnOff = () => {
    if (!canManage || !activeSession || pending) return;
    toggleSession.mutate(
      { sessionId: activeSession.id, isLive: true },
      {
        onSuccess: () => toast.info("Les joueurs ne te voient plus."),
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Impossible de couper.";
          toast.error(message);
        },
      }
    );
  };

  return (
    <View className={`rounded-2xl border p-4 ${live ? "border-accent/35 bg-accent/8" : "border-border bg-bg-card"}`}>
      <View className="min-h-[44px] flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            {live ? <PulseDot /> : null}
            <Text className={`font-display text-xl ${live ? "text-fg" : "text-fg-muted"}`}>{LIVE_UX_COPY.discoveryOn}</Text>
          </View>
          <Text className="mt-0.5 text-sm text-fg-muted">
            {live ? LIVE_UX_COPY.discoveryHintOn : LIVE_UX_COPY.discoveryHintOff}
          </Text>
          {live ? (
            <LiveCountdown expiresAt={activeSession?.expires_at ?? null} className="mt-1 text-xs text-fg-subtle" />
          ) : null}
        </View>
        {canManage ? (
          <Switch
            value={live}
            onValueChange={(next) => (next ? turnOn() : turnOff())}
            disabled={pending}
            trackColor={{ false: "#24272c", true: "#39ff8a" }}
            thumbColor="#f4f5f7"
            ios_backgroundColor="#24272c"
            accessibilityRole="switch"
            accessibilityLabel={LIVE_UX_COPY.discoveryOn}
            accessibilityState={{ checked: live, disabled: pending }}
          />
        ) : (
          <Text className="text-xs text-fg-subtle">Seul le manager peut passer en ligne.</Text>
        )}
      </View>
    </View>
  );
}
