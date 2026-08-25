import { Text } from "react-native";
import { Button } from "@/components/ui/Button";
import { COMPETITION_COPY, type CompetitionRegisterCtaKind } from "@/lib/competitions";

/**
 * CTA d'inscription honnête — jamais un bouton mort sur DRAFT/CLOSED.
 * 409 doublon : copy alreadyRegistered (Edge renvoie aussi le FR).
 */
export function CompetitionRegisterCta({
  kind,
  clubName,
  loading,
  onRegister,
  showNoManagedClub = false,
  registerCtaLabel,
  alreadyRegisteredLabel,
  draftLabel,
  closedLabel,
  noManagedClubLabel,
}: {
  kind: CompetitionRegisterCtaKind;
  clubName?: string | null;
  loading?: boolean;
  onRegister?: () => void;
  showNoManagedClub?: boolean;
  registerCtaLabel?: string;
  alreadyRegisteredLabel?: string;
  draftLabel?: string;
  closedLabel?: string;
  noManagedClubLabel?: string;
}) {
  if (kind === "register") {
    return (
      <Button loading={loading} onPress={onRegister} variant="secondary">
        {clubName ? `Inscrire ${clubName}` : (registerCtaLabel ?? COMPETITION_COPY.registerCta)}
      </Button>
    );
  }
  if (kind === "already_registered") {
    return (
      <Text className="text-xs font-bold text-accent">
        {alreadyRegisteredLabel ?? COMPETITION_COPY.alreadyRegistered}
      </Text>
    );
  }
  if (kind === "draft") {
    return <Text className="text-xs text-fg-muted">{draftLabel ?? COMPETITION_COPY.draftCannotRegister}</Text>;
  }
  if (kind === "closed") {
    return <Text className="text-xs text-fg-muted">{closedLabel ?? COMPETITION_COPY.closedCannotRegister}</Text>;
  }
  if (kind === "no_managed_club" && showNoManagedClub) {
    return <Text className="text-xs text-fg-muted">{noManagedClubLabel ?? COMPETITION_COPY.noManagedClub}</Text>;
  }
  return null;
}
