import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BadgeCheck } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useLinkEaClub, useSearchEaClub, type EaClubCandidate } from "@/lib/hooks/useProfile";
import { toast } from "@/lib/toast";

const COPY = {
  title: "Stats EA liées",
  intro: "Lie ton club EA SPORTS FC 27 pour afficher tes vraies stats sur ta ClubPro Card.",
  placeholder: "Nom exact de ton club EA",
  search: "Rechercher",
  empty: "Aucun club trouvé pour ce nom.",
  unavailable: "Endpoints EA indisponibles pour le moment. Réessaie plus tard.",
  hint: "Endpoints EA communautaires, non garantis : peut être temporairement indisponible.",
  pick: "Choisis ton club (nom + identifiant EA).",
  linkedSynced: "Club EA lié et stats synchronisées !",
  linkedPending: "Club EA lié. Stats en attente de sync.",
};

/** Lien vers le club EA SPORTS FC : search → liste → confirm. Jamais de first-hit. */
export function LinkEaClubForm() {
  const [eaClubName, setEaClubName] = useState("");
  const [candidates, setCandidates] = useState<EaClubCandidate[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const search = useSearchEaClub();
  const link = useLinkEaClub();

  const onNameChange = (value: string) => {
    setEaClubName(value);
    if (candidates !== null) {
      setCandidates(null);
      setUnavailable(false);
      setSelectedId(null);
    }
  };

  const runSearch = () => {
    const name = eaClubName.trim();
    if (!name) return;
    setSelectedId(null);
    search.mutate(name, {
      onSuccess: (data) => {
        setCandidates(data.candidates ?? []);
        setUnavailable(Boolean(data.unavailable));
      },
      onError: (err: unknown) => {
        setCandidates([]);
        setUnavailable(false);
        toast.error(err instanceof Error ? err.message : "Recherche EA impossible, réessaie plus tard.");
      },
    });
  };

  const runLink = (candidate: EaClubCandidate) => {
    setSelectedId(candidate.clubId);
    link.mutate(
      { eaClubId: candidate.clubId, eaClubName: eaClubName.trim() },
      {
        onSuccess: (data) => toast.success(data.synced ? COPY.linkedSynced : COPY.linkedPending),
        onError: (err: unknown) => {
          setSelectedId(null);
          toast.error(err instanceof Error ? err.message : "Liaison impossible, réessaie plus tard.");
        },
      }
    );
  };

  const showEmpty = candidates !== null && candidates.length === 0;
  const pending = search.isPending || link.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<BadgeCheck size={18} color="#39ff8a" />}>{COPY.title}</CardTitle>
      </CardHeader>
      <Text className="mb-3 text-sm text-fg-muted">{COPY.intro}</Text>
      <View className="flex-row gap-2">
        <Input
          className="flex-1"
          value={eaClubName}
          onChangeText={onNameChange}
          placeholder={COPY.placeholder}
          editable={!link.isPending}
          accessibilityLabel={COPY.placeholder}
        />
        <Button loading={search.isPending} disabled={pending || !eaClubName.trim()} onPress={runSearch}>
          {COPY.search}
        </Button>
      </View>
      {candidates !== null && candidates.length > 0 ? (
        <View className="mt-3 gap-2">
          <Text className="text-xs text-fg-muted">{COPY.pick}</Text>
          {candidates.map((c) => {
            const selected = selectedId === c.clubId;
            return (
              <Pressable
                key={c.clubId}
                onPress={() => runLink(c)}
                disabled={pending}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, identifiant ${c.clubId}`}
                className={`min-h-[44px] justify-center rounded-xl border px-3 py-2 ${
                  selected ? "border-accent bg-accent/15" : "border-border bg-bg-elevated"
                } ${pending ? "opacity-50" : "active:opacity-80"}`}
              >
                <Text className="text-sm font-bold text-fg">{c.name}</Text>
                <Text className="text-xs text-fg-muted">{c.clubId}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {showEmpty ? (
        <Text className="mt-3 text-sm text-fg-muted">{unavailable ? COPY.unavailable : COPY.empty}</Text>
      ) : null}
      <Text className="mt-2 text-xs text-fg-subtle">{COPY.hint}</Text>
    </Card>
  );
}
