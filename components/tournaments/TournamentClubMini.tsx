import { router } from "expo-router";
import { ClubCard } from "@/components/club/ClubCard";
import { buildClubCardData } from "@/lib/clubCard";
import { clubRankingRowHref } from "@/lib/rankings";
import { tournamentClubDisplayName } from "@/lib/tournaments";

/**
 * ClubCard MINI pour le tableau / la progression.
 * Nom manquant ou placeholder → rien (pas « Club Pro Clubs »).
 * Tap profil seulement si `clubRankingRowHref` accepte l'id + le nom.
 */
export function TournamentClubMini({
  clubId,
  name,
  interactive = true,
  className,
}: {
  clubId: string;
  name: string | null | undefined;
  interactive?: boolean;
  className?: string;
}) {
  const display = tournamentClubDisplayName(name);
  if (!display) return null;
  const href = clubRankingRowHref(clubId, display);
  const canPress = interactive && Boolean(href);
  return (
    <ClubCard
      data={buildClubCardData({ id: clubId, name: display })}
      variant="mini"
      interactive={canPress}
      onPress={canPress && href ? () => router.push(href) : undefined}
      className={className}
    />
  );
}
