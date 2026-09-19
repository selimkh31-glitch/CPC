import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BadgeCheck } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PLAYER_CARD_COPY } from "@/lib/playerCard";
import {
  canCallLinkEaClub,
  formatVisibleMembers,
  isNumericEaClubId,
  type LinkEaClubPhase,
} from "@/lib/eaClubClaim";
import {
  useLinkEaClub,
  usePreviewEaClub,
  useSearchEaClub,
  useUnlinkEaClub,
  type EaClubCandidate,
} from "@/lib/hooks/useProfile";
import { toast } from "@/lib/toast";

export const LINK_EA_CLUB_COPY = {
  title: PLAYER_CARD_COPY.linkClub,
  section: "Stats EA liées",
  intro: "Cherche le nom exact. Tu peux jouer sans.",
  placeholder: "Nom exact de ton club EA",
  search: "Chercher",
  empty: "Aucun club trouvé pour ce nom.",
  unavailable: "Endpoints EA indisponibles pour le moment. Réessaie plus tard.",
  hint: "Endpoints communautaires, non garantis. Pas un id joueur officiel.",
  pick: "C'est lequel ?",
  idLabel: "ID EA",
  confirm: "Confirmer",
  cancel: "Annuler",
  unlink: "Délier",
  relink: "Chercher un autre club",
  linkedNow: (id: string) => `Club déjà lié · ID EA ${id}`,
  confirmLead: (name: string, clubId: string) =>
    `Tu liais ${name} · ID EA ${clubId}. Ton pseudo CPC doit être identique au nom joueur EA pour les stats.`,
  linkedSynced: "Club EA lié. Stats syncées.",
  linkedPending: "Club EA lié. Stats en attente de sync.",
  unlinked: "Club EA délié. Tu peux en chercher un autre.",
} as const;

function candidateHint(c: EaClubCandidate): string | null {
  const bits: string[] = [];
  if (typeof c.gamesPlayed === "number" && Number.isFinite(c.gamesPlayed)) {
    bits.push(`${c.gamesPlayed} matchs`);
  }
  if (typeof c.rank === "number" && Number.isFinite(c.rank)) {
    bits.push(`rang ${c.rank}`);
  }
  return bits.length > 0 ? bits.join(" · ") : null;
}

/** Lien vers le club EA SPORTS FC : search → liste → confirm. Jamais de first-hit. */
export function LinkEaClubForm({
  embedded = false,
  linkedClubId = null,
  onLinked,
  onUnlinked,
}: {
  embedded?: boolean;
  linkedClubId?: string | null;
  onLinked?: () => void;
  onUnlinked?: () => void;
}) {
  const [eaClubName, setEaClubName] = useState("");
  const [candidates, setCandidates] = useState<EaClubCandidate[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<EaClubCandidate | null>(null);
  const [memberPreview, setMemberPreview] = useState<string[] | null>(null);
  const search = useSearchEaClub();
  const preview = usePreviewEaClub();
  const link = useLinkEaClub();
  const unlink = useUnlinkEaClub();

  const phase: LinkEaClubPhase = pendingConfirm ? "confirm" : candidates !== null ? "candidates" : "search";

  const clearResults = () => {
    setCandidates(null);
    setUnavailable(false);
    setPendingConfirm(null);
    setMemberPreview(null);
  };

  const onNameChange = (value: string) => {
    setEaClubName(value);
    if (candidates !== null || pendingConfirm) clearResults();
  };

  const runSearch = () => {
    const name = eaClubName.trim();
    if (!name) return;
    setPendingConfirm(null);
    setMemberPreview(null);
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

  const selectCandidate = (candidate: EaClubCandidate) => {
    if (!isNumericEaClubId(candidate.clubId)) {
      toast.error("Cet identifiant n'est pas un clubId EA.");
      return;
    }
    setPendingConfirm(candidate);
    setMemberPreview(null);
    preview.mutate(
      { eaClubId: candidate.clubId, eaClubName: eaClubName.trim() },
      {
        onSuccess: (data) => setMemberPreview(data.members ?? []),
        onError: () => setMemberPreview([]),
      }
    );
  };

  const runLink = () => {
    if (!pendingConfirm || !canCallLinkEaClub(phase)) return;
    link.mutate(
      { eaClubId: pendingConfirm.clubId, eaClubName: eaClubName.trim() },
      {
        onSuccess: (data) => {
          const clubId = data.clubId ?? data.eaClubId ?? pendingConfirm.clubId;
          const name = data.name ?? pendingConfirm.name;
          const base = data.synced ? LINK_EA_CLUB_COPY.linkedSynced : LINK_EA_CLUB_COPY.linkedPending;
          toast.success(`${base} ${name} · ID EA ${clubId}`);
          onLinked?.();
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Liaison impossible, réessaie plus tard.");
        },
      }
    );
  };

  const runUnlink = () => {
    unlink.mutate(undefined, {
      onSuccess: () => {
        toast.success(LINK_EA_CLUB_COPY.unlinked);
        clearResults();
        onUnlinked?.();
      },
      onError: (err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Impossible de délier.");
      },
    });
  };

  const showEmpty = candidates !== null && candidates.length === 0 && !pendingConfirm;
  const pending = search.isPending || link.isPending || unlink.isPending;
  const membersLabel = formatVisibleMembers(memberPreview ?? []);

  const body = (
    <>
      {!embedded ? (
        <CardHeader>
          <CardTitle icon={<BadgeCheck size={18} color="#39ff8a" />}>{LINK_EA_CLUB_COPY.title}</CardTitle>
        </CardHeader>
      ) : null}
      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-fg-subtle">{LINK_EA_CLUB_COPY.section}</Text>
      <Text className="mb-3 text-sm text-fg-muted">{LINK_EA_CLUB_COPY.intro}</Text>
      {linkedClubId ? (
        <View className="mb-3 rounded-xl border border-border bg-bg-elevated px-3 py-2">
          <Text className="text-sm text-fg">{LINK_EA_CLUB_COPY.linkedNow(linkedClubId)}</Text>
          <View className="mt-2 flex-row gap-2">
            <Button variant="secondary" size="sm" loading={unlink.isPending} disabled={pending} onPress={runUnlink}>
              {LINK_EA_CLUB_COPY.unlink}
            </Button>
          </View>
          <Text className="mt-2 text-xs text-fg-subtle">{LINK_EA_CLUB_COPY.relink}</Text>
        </View>
      ) : null}
      <View className="flex-row gap-2">
        <Input
          className="flex-1"
          value={eaClubName}
          onChangeText={onNameChange}
          placeholder={LINK_EA_CLUB_COPY.placeholder}
          editable={!link.isPending}
          accessibilityLabel={LINK_EA_CLUB_COPY.placeholder}
        />
        <Button loading={search.isPending} disabled={pending || !eaClubName.trim()} onPress={runSearch}>
          {LINK_EA_CLUB_COPY.search}
        </Button>
      </View>
      {candidates !== null && candidates.length > 0 ? (
        <View className="mt-3 gap-2">
          <Text className="text-xs text-fg-muted">{LINK_EA_CLUB_COPY.pick}</Text>
          {candidates.map((c) => {
            const selected = pendingConfirm?.clubId === c.clubId;
            const hint = candidateHint(c);
            return (
              <Pressable
                key={c.clubId}
                onPress={() => selectCandidate(c)}
                disabled={pending}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, identifiant ${c.clubId}`}
                className={`min-h-[56px] justify-center rounded-xl border px-3 py-2.5 ${
                  selected ? "border-accent bg-accent/15" : "border-border bg-bg-elevated"
                } ${pending ? "opacity-50" : "active:opacity-80"}`}
              >
                <Text className="text-base font-bold text-fg">{c.name}</Text>
                <Text className="mt-0.5 font-mono text-base text-fg">
                  {LINK_EA_CLUB_COPY.idLabel} {c.clubId}
                </Text>
                {c.platform ? <Text className="mt-0.5 text-xs text-fg-muted">{c.platform}</Text> : null}
                {hint ? <Text className="text-xs text-fg-subtle">{hint}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {pendingConfirm ? (
        <View className="mt-3 rounded-xl border border-accent bg-accent/10 px-3 py-3">
          <Text className="text-sm text-fg">
            Tu liais <Text className="font-bold">{pendingConfirm.name}</Text>
            {" · "}
            {LINK_EA_CLUB_COPY.idLabel} <Text className="font-mono text-base font-bold">{pendingConfirm.clubId}</Text>
            {". Ton pseudo CPC doit être "}
            <Text className="font-bold">identique</Text>
            {" au nom joueur EA pour les stats."}
          </Text>
          {membersLabel ? <Text className="mt-2 text-xs text-fg-muted">{membersLabel}</Text> : null}
          <View className="mt-3 flex-row gap-2">
            <Button className="flex-1" loading={link.isPending} disabled={pending} onPress={runLink}>
              {LINK_EA_CLUB_COPY.confirm}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={pending}
              onPress={() => {
                setPendingConfirm(null);
                setMemberPreview(null);
              }}
            >
              {LINK_EA_CLUB_COPY.cancel}
            </Button>
          </View>
        </View>
      ) : null}
      {showEmpty ? (
        <Text className="mt-3 text-sm text-fg-muted">
          {unavailable ? LINK_EA_CLUB_COPY.unavailable : LINK_EA_CLUB_COPY.empty}
        </Text>
      ) : null}
      <Text className="mt-2 text-xs text-fg-subtle">{LINK_EA_CLUB_COPY.hint}</Text>
    </>
  );

  if (embedded) return <View>{body}</View>;
  return <Card>{body}</Card>;
}
