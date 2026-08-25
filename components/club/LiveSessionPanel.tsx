import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Radio } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PulseDot } from "@/components/ui/PulseDot";
import { Sheet } from "@/components/ui/Sheet";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { POSITIONS, POSITION_LABELS } from "@/lib/constants";
import { DEFAULT_LIVE_DURATION_MS, LIVE_DURATION_OPTIONS, parseLiveDurationMs } from "@/lib/live";
import { formatNeededPositionsLine } from "@/lib/sessionState";
import { useCreateSession, useToggleSession } from "@/lib/hooks/useClubs";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface LiveSessionPanelProps {
  clubId: string;
  activeSession: { id: string; needed_positions: string[]; note: string | null; expires_at?: string | null } | null;
  /** Mutations OWNER/MANAGER only — RLS reste la source de vérité. */
  canManage?: boolean;
}

/**
 * LIVE club — UX compacte PR #5 (carte OFF/ON + sheet) + mapping session PR #7.
 * Postes toujours requis pour passer LIVE. API TTL / matching inchangée.
 */
export function LiveSessionPanel({ clubId, activeSession, canManage = true }: LiveSessionPanelProps) {
  const [positions, setPositions] = useState<string[]>(activeSession?.needed_positions ?? []);
  const [note, setNote] = useState(activeSession?.note ?? "");
  const [duration, setDuration] = useState(String(DEFAULT_LIVE_DURATION_MS));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
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
      toast.error("Sélectionne au moins un poste recherché.");
      return;
    }
    createSession.mutate(
      { neededPositions: positions, note: note.trim() || undefined, durationMs: parseLiveDurationMs(duration) },
      {
        onSuccess: () => {
          toast.success("Club LIVE ! Visible dans le feed FC 27 Pro Clubs.");
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
      { onSuccess: () => toast.info("LIVE club terminé.") }
    );
  };

  const neededLabel = formatNeededPositionsLine(activeSession?.needed_positions ?? positions);

  return (
    <Card className={cn("p-5", live && "border-accent/40 bg-accent/10")}>
      {live ? (
        <>
          <View className="mb-1 flex-row items-start gap-2">
            <PulseDot />
            <Text className="flex-1 font-display text-xl text-fg">Le club est LIVE</Text>
            <LiveCountdown expiresAt={activeSession?.expires_at ?? null} />
          </View>
          <Text className="text-sm text-fg-muted">Les joueurs peuvent te trouver.</Text>
          {neededLabel ? (
            <Text numberOfLines={2} className="mt-2 text-xs font-semibold text-fg">
              Cherche {neededLabel}
            </Text>
          ) : null}
          {activeSession?.note ? <Text className="mt-1 text-sm text-fg-muted">{activeSession.note}</Text> : null}
          <Text className="mt-2 text-xs text-fg-subtle">
            Recrutement roster EA SPORTS FC 27 Pro Clubs — distinct du match lancé sur la feuille.
          </Text>
          {canManage ? (
            <View className="mt-3 flex-row gap-2">
              <Button size="sm" variant="ghost" onPress={() => setSheetOpen(true)} className="flex-1">
                Modifier
              </Button>
              <Button size="sm" variant="danger" loading={toggleSession.isPending} onPress={goOffline} className="flex-1">
                Quitter le LIVE
              </Button>
            </View>
          ) : (
            <Text className="mt-3 text-sm text-fg-subtle">Seul l&apos;owner ou un manager peut couper le LIVE.</Text>
          )}
        </>
      ) : (
        <>
          <View className="mb-1 flex-row items-start gap-2">
            <Radio size={16} color="#9aa0a8" />
            <Text className="flex-1 font-display text-xl text-fg">Tu recrutes maintenant ?</Text>
          </View>
          <Text className="mb-4 text-sm text-fg-muted">Passe LIVE. Les joueurs te voient tout de suite.</Text>
          {canManage ? (
            <>
              <Button size="lg" loading={createSession.isPending} onPress={() => setSheetOpen(true)}>
                Passer LIVE
              </Button>
              <Pressable
                onPress={() => setShowDetails((v) => !v)}
                className="mt-2 min-h-[44px] items-center justify-center"
                accessibilityRole="button"
              >
                <Text className="text-xs font-semibold text-fg-subtle">Détails</Text>
              </Pressable>
              {showDetails ? (
                <Text className="text-[11px] leading-4 text-fg-subtle">
                  Indique les postes recherchés et une durée. Le LIVE expire tout seul. Recrutement roster
                  EA SPORTS FC 27 Pro Clubs uniquement — ce n&apos;est pas un coup d&apos;envoi de match.
                </Text>
              ) : null}
            </>
          ) : (
            <Text className="text-sm text-fg-subtle">Seul l&apos;owner ou un manager peut publier un recrutement LIVE.</Text>
          )}
        </>
      )}

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={live ? "Modifier le LIVE" : "Passer LIVE"}>
        <Text className="mb-3 text-sm text-fg-muted">
          Les joueurs LIVE voient ce club dans Trouver un club. Au moins un poste est requis.
        </Text>

        <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Postes recherchés</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
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

        <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Durée</Text>
        <View className="mb-3 flex-row rounded-2xl border border-border bg-bg-elevated p-1">
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
          <Text className="text-xs font-semibold text-fg-subtle">
            {showMore ? "Masquer la note" : "Note (optionnel)"}
          </Text>
        </Pressable>
        {showMore ? (
          <View className="mb-3">
            <Input
              value={note}
              onChangeText={setNote}
              placeholder="Ex : On lance dans 10 min"
              maxLength={200}
            />
          </View>
        ) : null}

        <Button loading={createSession.isPending} onPress={goLive}>
          {live ? "Mettre à jour" : "Passer LIVE"}
        </Button>
      </Sheet>
    </Card>
  );
}
