import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Radio } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PulseDot } from "@/components/ui/PulseDot";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { PositionPicker } from "@/components/club/PositionPicker";
import { DEFAULT_LIVE_DURATION_MS, LIVE_DURATION_OPTIONS, parseLiveDurationMs } from "@/lib/live";
import { formatNeededPositionsLine } from "@/lib/sessionState";
import { useCreateSession, useToggleSession } from "@/lib/hooks/useClubs";
import { toast } from "@/lib/toast";

interface LiveSessionPanelProps {
  clubId: string;
  activeSession: { id: string; needed_positions: string[]; note: string | null; expires_at?: string | null } | null;
  /** Mutations OWNER/MANAGER only — RLS reste la source de vérité. */
  canManage?: boolean;
}

/** Recrutement LIVE ON/OFF — postes en une ligne, pas un mur de chips. */
export function LiveSessionPanel({ clubId, activeSession, canManage = true }: LiveSessionPanelProps) {
  const [positions, setPositions] = useState<string[]>(activeSession?.needed_positions ?? []);
  const [note, setNote] = useState(activeSession?.note ?? "");
  const [duration, setDuration] = useState(String(DEFAULT_LIVE_DURATION_MS));
  const createSession = useCreateSession(clubId);
  const toggleSession = useToggleSession(clubId);

  const sessionId = activeSession?.id ?? null;
  const sessionNote = activeSession?.note ?? "";
  const sessionPositionsKey = activeSession?.needed_positions.join(",") ?? "";

  useEffect(() => {
    if (!sessionId) return;
    setPositions(sessionPositionsKey ? sessionPositionsKey.split(",") : []);
    setNote(sessionNote);
  }, [sessionId, sessionNote, sessionPositionsKey]);

  const goLive = () => {
    if (positions.length === 0) {
      toast.error("Sélectionne au moins un poste recherché.");
      return;
    }
    createSession.mutate(
      { neededPositions: positions, note: note.trim() || undefined, durationMs: parseLiveDurationMs(duration) },
      {
        onSuccess: () => toast.success("Club LIVE ! Visible dans le feed FC 27 Pro Clubs."),
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  const goOffline = () => {
    if (!activeSession) return;
    toggleSession.mutate(
      { sessionId: activeSession.id, isLive: true },
      { onSuccess: () => toast.info("Recrutement LIVE terminé.") }
    );
  };

  const livePositions = activeSession ? formatNeededPositionsLine(activeSession.needed_positions) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Radio size={18} color="#f4f5f7" />}>Recrutement LIVE</CardTitle>
        {activeSession && (
          <View className="flex-row items-center gap-1.5">
            <PulseDot />
            <Text className="text-xs font-extrabold text-accent">LIVE</Text>
            <LiveCountdown expiresAt={activeSession.expires_at ?? null} />
          </View>
        )}
      </CardHeader>

      {activeSession ? (
        <View className="gap-3">
          {livePositions ? <Text className="text-sm text-fg">Cherche {livePositions}</Text> : null}
          {activeSession.note ? <Text className="text-sm text-fg-muted">{activeSession.note}</Text> : null}
          <Text className="text-xs text-fg-subtle">
            Recrutement roster EA SPORTS FC 27 Pro Clubs — distinct du match lancé sur la feuille.
          </Text>
          {canManage ? (
            <Button variant="danger" loading={toggleSession.isPending} onPress={goOffline}>
              Passer OFFLINE
            </Button>
          ) : (
            <Text className="text-sm text-fg-subtle">Seul l&apos;owner ou un manager peut couper le LIVE.</Text>
          )}
        </View>
      ) : (
        <View className="gap-3">
          <Text className="text-xs text-fg-subtle">
            Publie le club dans le feed pour recruter maintenant. Ce n&apos;est pas un coup d&apos;envoi de match.
          </Text>
          {canManage ? (
            <>
              <View>
                <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Postes recherchés</Text>
                <PositionPicker value={positions} onChange={setPositions} />
              </View>
              <View>
                <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Durée du LIVE</Text>
                <View className="flex-row gap-2">
                  {LIVE_DURATION_OPTIONS.map((opt) => {
                    const selected = duration === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        accessibilityRole="button"
                        accessibilityLabel={opt.label}
                        onPress={() => setDuration(opt.value)}
                        className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border px-2 ${
                          selected ? "border-accent bg-accent/15" : "border-border bg-bg-elevated"
                        }`}
                      >
                        <Text className={`text-sm font-bold ${selected ? "text-accent" : "text-fg-muted"}`}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Input value={note} onChangeText={setNote} placeholder="Note (optionnel) — ex. On lance dans 10 min" maxLength={200} />
              <Button loading={createSession.isPending} onPress={goLive}>
                Passer LIVE
              </Button>
            </>
          ) : (
            <Text className="text-sm text-fg-subtle">Seul l&apos;owner ou un manager peut publier un recrutement LIVE.</Text>
          )}
        </View>
      )}
    </Card>
  );
}
