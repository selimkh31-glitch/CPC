import { useState } from "react";
import { Text, View } from "react-native";
import { Radio } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { PulseDot } from "@/components/ui/PulseDot";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import { POSITIONS, POSITION_LABELS } from "@/lib/constants";
import { DEFAULT_LIVE_DURATION_MS, LIVE_DURATION_OPTIONS, parseLiveDurationMs } from "@/lib/live";
import { useCreateSession, useToggleSession } from "@/lib/hooks/useClubs";
import { toast } from "@/lib/toast";

interface LiveSessionPanelProps {
  clubId: string;
  activeSession: { id: string; needed_positions: string[]; note: string | null; expires_at?: string | null } | null;
}

/** Toggle session LIVE ON/OFF + postes recherchés (section 3.B). */
export function LiveSessionPanel({ clubId, activeSession }: LiveSessionPanelProps) {
  const [positions, setPositions] = useState<string[]>(activeSession?.needed_positions ?? []);
  const [note, setNote] = useState(activeSession?.note ?? "");
  const [duration, setDuration] = useState([String(DEFAULT_LIVE_DURATION_MS)]);
  const createSession = useCreateSession(clubId);
  const toggleSession = useToggleSession(clubId);

  const goLive = () => {
    if (positions.length === 0) {
      toast.error("Sélectionne au moins un poste recherché.");
      return;
    }
    createSession.mutate(
      { neededPositions: positions, note: note.trim() || undefined, durationMs: parseLiveDurationMs(duration[0]) },
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
      { onSuccess: () => toast.info("Session terminée. 🔌") }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Radio size={18} color="#f4f5f7" />}>Session</CardTitle>
        {activeSession && (
          <View className="flex-row items-center gap-1.5">
            <PulseDot />
            <Text className="text-xs font-extrabold text-accent">LIVE</Text>
            <LiveCountdown expiresAt={activeSession.expires_at ?? null} />
          </View>
        )}
      </CardHeader>

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Postes recherchés (roster FC 27)</Text>
      <ChipSelect value={positions} onChange={setPositions} options={POSITIONS.map((p) => ({ value: p, label: POSITION_LABELS[p] }))} />

      {!activeSession && (
        <View className="mt-3">
          <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Durée du LIVE</Text>
          <ChipSelect single value={duration} onChange={(v) => setDuration(v.length ? v : [String(DEFAULT_LIVE_DURATION_MS)])} options={[...LIVE_DURATION_OPTIONS]} />
        </View>
      )}

      <View className="mt-3">
        <Input value={note} onChangeText={setNote} placeholder="Note (optionnel) — ex: 'On lance dans 10 min'" maxLength={200} />
      </View>

      <View className="mt-4">
        {activeSession ? (
          <Button variant="danger" loading={toggleSession.isPending} onPress={goOffline}>
            Passer OFFLINE
          </Button>
        ) : (
          <Button loading={createSession.isPending} onPress={goLive}>
            Passer LIVE
          </Button>
        )}
      </View>
    </Card>
  );
}
