import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Badge } from "@/components/ui/Badge";
import { FORMATIONS, type FormationId, type FormationSlot } from "@/lib/formations";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { canPressEmptyFormationSlot } from "@/lib/sessionState";
import type { SlotAssignmentRow } from "@/lib/types";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

const SLOT_W = cpcTokens.geometry.formationSlotWidth;
const SLOT_H = cpcTokens.geometry.formationSlotHeight;

/**
 * Terrain visuel réutilisable (owner ET joueur, lecture ou interaction selon
 * `interactive`). Les 11 slots viennent exclusivement de lib/formations.ts —
 * jamais de coordonnées codées ici : la formation reste l'unique source de
 * vérité structurelle (voir architecture validée, phase 1/2).
 */
export function FormationPitch({
  formationId,
  assignments,
  interactive = true,
  onEmptySlotPress,
  currentUserId = null,
  emptySlotHint = "Rechercher",
  clubId = null,
}: {
  formationId: FormationId;
  assignments: SlotAssignmentRow[];
  interactive?: boolean;
  /** Appelé au tap d'un slot vide (recherche côté owner, candidature côté joueur).
   *  Sans callback, le slot vide n'est pas tappable. */
  onEmptySlotPress?: (slot: FormationSlot) => void;
  /** Si fourni, le slot occupé par ce user est marqué "Vous" (Phase 4.6) —
   *  purement visuel, ne change aucune permission. */
  currentUserId?: string | null;
  /** Hint a11y d’un slot vide — jamais rendu comme texte sur le terrain
   *  (codes ST/LW uniquement). Tap / routing inchangés. */
  emptySlotHint?: string;
  /** Club de la feuille — passé au profil pour « Retirer de la feuille ». */
  clubId?: string | null;
}) {
  const slots = FORMATIONS[formationId];
  const bySlot = new Map(assignments.map((a) => [a.slot_id, a]));

  return (
    <View
      className="w-full overflow-hidden border border-pitch-line/20 bg-pitch"
      style={{ aspectRatio: 0.72, borderRadius: cpcTokens.radius.card, backgroundColor: cpcHex.pitch }}
    >
      {/* Lignes de terrain minimalistes — pas d'asset graphique. */}
      <View className="absolute inset-4 border" style={{ borderColor: cpcHex.pitchLine, opacity: 0.25 }} />
      <View className="absolute left-4 right-4 top-1/2 h-px" style={{ backgroundColor: cpcHex.pitchLine, opacity: 0.25 }} />
      <View
        className="absolute self-center rounded-full border"
        style={{ top: "50%", width: 70, height: 70, marginTop: -35, borderColor: cpcHex.pitchLine, opacity: 0.25 }}
      />

      {slots.map((slot) => (
        <PitchSlot
          key={slot.slotId}
          slot={slot}
          occupant={bySlot.get(slot.slotId) ?? null}
          interactive={interactive}
          onEmptySlotPress={onEmptySlotPress}
          isYou={Boolean(currentUserId && bySlot.get(slot.slotId)?.user_id === currentUserId)}
          emptySlotHint={emptySlotHint}
          clubId={clubId}
        />
      ))}
    </View>
  );
}

function PitchSlot({
  slot,
  occupant,
  interactive,
  onEmptySlotPress,
  isYou,
  emptySlotHint,
  clubId,
}: {
  slot: FormationSlot;
  occupant: SlotAssignmentRow | null;
  interactive: boolean;
  onEmptySlotPress?: (slot: FormationSlot) => void;
  isYou: boolean;
  emptySlotHint: string;
  clubId: string | null;
}) {
  const positionLabel = POSITION_LABELS[slot.position as PositionCode] ?? slot.position;
  const isEmpty = !occupant?.user;

  // Foundation #2.1 — `interactive` ne gouverne QUE l'affordance de
  // recrutement/candidature d'un slot VIDE (Mode Joueur vs Mode Club). Un
  // slot OCCUPÉ reste toujours cliquable -> profil, quel que soit
  // `interactive` : sans ça, ClubHome (Mode Joueur, interactive=false)
  // perdrait le tap-vers-profil sur ses propres titulaires, ce qui n'est pas
  // la règle produit (seul le recrutement doit disparaître en Mode Joueur).
  // Sans handler, un slot vide n'est pas tappable (pas de toast « bientôt »).
  const canOpenEmpty = canPressEmptyFormationSlot(interactive, Boolean(onEmptySlotPress));
  const disabled = isEmpty && !canOpenEmpty;

  const onPress = () => {
    if (occupant?.user) {
      Haptics.selectionAsync();
      const href = clubId
        ? `/profile/${occupant.user_id}?clubId=${encodeURIComponent(clubId)}`
        : `/profile/${occupant.user_id}`;
      router.push(href);
      return;
    }
    if (!canOpenEmpty || !onEmptySlotPress) return;
    Haptics.selectionAsync();
    onEmptySlotPress(slot);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        occupant?.user
          ? occupant.user.username
          : canOpenEmpty
            ? `${positionLabel}. ${emptySlotHint}`
            : positionLabel
      }
      className="absolute items-center active:opacity-80"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: SLOT_W,
        height: SLOT_H,
        marginLeft: -SLOT_W / 2,
        marginTop: -SLOT_H / 2 - 10,
      }}
    >
      {occupant?.user ? (
        <>
          <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-accent bg-bg-elevated">
            <Text className="font-display text-[11px] font-bold text-accent" style={{ color: cpcHex.accent }}>
              {occupant.user.username.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text numberOfLines={1} className="mt-0.5 max-w-[64px] text-center text-[10px] font-bold text-fg" style={{ color: cpcHex.textPrimary }}>
            {occupant.user.username}
          </Text>
          {isYou && <Badge tone="accent" className="mt-0.5 self-center px-1.5 py-0.5">Vous</Badge>}
        </>
      ) : canOpenEmpty ? (
        <>
          <View className="h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/[0.04]">
            <Text className="font-display text-lg leading-none text-white/35">+</Text>
          </View>
          <Text className="mt-0.5 font-mono text-[9px] font-bold tracking-wide text-white/40">
            {slot.position}
          </Text>
        </>
      ) : (
        // Non-interactif (Mode Joueur, Foundation #2.1) : code de poste
        // uniquement — pas de "+", pas d'indice visuel, aucune affordance.
        <>
          <View className="h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5" />
          <Text className="mt-0.5 font-mono text-[9px] font-bold tracking-wide text-white/40">
            {slot.position}
          </Text>
        </>
      )}
    </Pressable>
  );
}
