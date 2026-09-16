import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PulseDot } from "@/components/ui/PulseDot";
import { Sheet } from "@/components/ui/Sheet";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { POSITIONS, POSITION_LABELS } from "@/lib/constants";
import {
  DEFAULT_LIVE_DURATION_MS,
  LIVE_DURATION_OPTIONS,
  LIVE_UX_COPY,
  parseLiveDurationMs,
} from "@/lib/live";
import { formatNeededPositionsLine } from "@/lib/sessionState";
import { useCreateSession, useToggleSession } from "@/lib/hooks/useClubs";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface LiveSessionPanelProps {
  clubId: string;
  activeSession: { id: string; needed_positions: string[]; note: string | null; expires_at?: string | null } | null;
  canManage?: boolean;
  /** Match lancé : « Quitter » (même toggle session), pas un nouvel API. */
  stopLabel?: string;
}

/**
 * LIVE club — états off / open. Postes requis. API TTL / matching inchangée.
 */
export function LiveSessionPanel({
  clubId,
  activeSession,
  canManage = true,
  stopLabel = LIVE_UX_COPY.stop,
}: LiveSessionPanelProps) {
  const [positions, setPositions] = useState<string[]>(activeSession?.needed_positions ?? []);
  const [note, setNote] = useState(activeSession?.note ?? "");
  const [duration, setDuration] = useState(String(DEFAULT_LIVE_DURATION_MS));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const createSession = useCreateSession(clubId);
  const toggleSession = useToggleSession(clubId);
  const live = Boolean(activeSession);

  const sessionId = activeSession?.id ?? null;
  const sessionNote = activeSession?.note ?? "";
  const sessionPositionsKey = activeSession?.needed_positions.join(",") ?? "";

  useEffect(() => {
    if (!sessionId) return;
    setPositions(sessionPositionsKey ? sessionPositionsKey.split(",") : []);
    setNote(sessionNote);
  }, [sessionId, sessionNote, sessionPositionsKey]);

  const togglePosition = (code: string) => {
    setPositions((prev) => (prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]));
  };

  const goLive = () => {
    if (!canManage || createSession.isPending) return;
    if (positions.length === 0) {
      toast.error("Choisis au moins un poste.");
      return;
    }
    createSession.mutate(
      { neededPositions: positions, note: note.trim() || undefined, durationMs: parseLiveDurationMs(duration) },
      {
        onSuccess: () => {
          toast.success("Club en LIVE. Les joueurs te voient.");
          setSheetOpen(false);
          setShowMore(false);
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  const goOffline = () => {
    if (!canManage || !activeSession) return;
    toggleSession.mutate(
      { sessionId: activeSession.id, isLive: true },
      { onSuccess: () => toast.info("C'est coupé.") }
    );
  };

  const neededLabel = formatNeededPositionsLine(activeSession?.needed_positions ?? positions);

  return (
    <Card className={cn("rounded-[28px] p-6", live && "border-accent/35 bg-accent/8")}>
      {live ? (
        <>
          <View className="mb-2 flex-row items-start gap-2">
            <PulseDot />
            <Text className="flex-1 font-display text-2xl text-fg">{LIVE_UX_COPY.clubOpenTitle}</Text>
          </View>
          <Text className="text-sm text-fg-muted">{LIVE_UX_COPY.clubStillLooking}</Text>
          {neededLabel ? (
            <Text numberOfLines={2} className="mt-3 text-base font-semibold text-fg">
              On cherche {neededLabel}
            </Text>
          ) : null}
          {activeSession?.note ? <Text className="mt-1 text-sm text-fg-muted">{activeSession.note}</Text> : null}
          <LiveCountdown expiresAt={activeSession?.expires_at ?? null} className="mt-2 text-sm" />
          {canManage ? (
            <>
              <Pressable
                onPress={() => setSheetOpen(true)}
                className="mt-4 min-h-[44px] justify-center"
                accessibilityRole="button"
              >
                <Text className="text-sm text-fg-subtle">{LIVE_UX_COPY.edit}</Text>
              </Pressable>
              <Button variant="ghost" className="mt-1 min-h-[44px]" loading={toggleSession.isPending} onPress={goOffline}>
                {stopLabel}
              </Button>
            </>
          ) : (
            <Text className="mt-4 text-sm text-fg-subtle">Seul l&apos;owner ou un manager peut couper.</Text>
          )}
        </>
      ) : (
        <>
          <Text className="font-display text-2xl text-fg">{LIVE_UX_COPY.clubHeadline}</Text>
          <Text className="mb-5 mt-2 text-sm text-fg-muted">Passe LIVE. Les joueurs te voient tout de suite.</Text>
          {canManage ? (
            <Button size="lg" loading={createSession.isPending} onPress={() => setSheetOpen(true)}>
              {LIVE_UX_COPY.goLive}
            </Button>
          ) : (
            <Text className="text-sm text-fg-subtle">Seul l&apos;owner ou un manager peut passer LIVE.</Text>
          )}
        </>
      )}

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={live ? LIVE_UX_COPY.edit : LIVE_UX_COPY.goLive}>
        <Text className="mb-4 text-sm text-fg-muted">Au moins un poste. Ça s&apos;arrête tout seul.</Text>

        <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Postes</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {POSITIONS.map((code) => {
            const active = positions.includes(code);
            return (
              <Pressable
                key={code}
                onPress={() => togglePosition(code)}
                className={`min-h-[44px] min-w-[72px] flex-1 basis-[22%] items-center justify-center rounded-xl border px-2 ${
                  active ? "border-accent bg-accent/15" : "border-border bg-bg-elevated"
                }`}
              >
                <Text className={`text-xs font-bold ${active ? "text-accent" : "text-fg-muted"}`}>{code}</Text>
                <Text numberOfLines={1} className={`text-[10px] ${active ? "text-accent" : "text-fg-subtle"}`}>
                  {POSITION_LABELS[code]}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
                className={`min-h-[44px] flex-1 justify-center rounded-xl px-2 ${active ? "bg-accent" : ""}`}
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
          className="mb-2 min-h-[44px] justify-center"
          accessibilityRole="button"
        >
          <Text className="text-sm text-fg-subtle">{showMore ? LIVE_UX_COPY.hideNote : LIVE_UX_COPY.noteOptional}</Text>
        </Pressable>
        {showMore ? (
          <View className="mb-4">
            <Input value={note} onChangeText={setNote} placeholder="Ex : On lance dans 10 min" maxLength={200} />
          </View>
        ) : null}

        <Button loading={createSession.isPending} onPress={goLive}>
          {live ? "C'est bon" : LIVE_UX_COPY.goLive}
        </Button>
      </Sheet>
    </Card>
  );
}
