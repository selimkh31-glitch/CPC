/**
 * Provenance d'une métrique affichée. Jamais inventer une source EA.
 * - EA : chiffre issu d'un payload club EA (rapprochement par pseudo, pas un id joueur).
 * - CPC : donnée produit (fiabilité, streak, reviews).
 * - CALCULATED : dérivé CPC (OVR, rareté).
 */
export type StatsSource = "EA" | "CPC" | "CALCULATED";

export type EaIdentityKind = "NONE" | "USERNAME_EQUALITY";

export function statsSourceLabel(source: StatsSource): string {
  switch (source) {
    case "EA":
      return "EA (club lié)";
    case "CPC":
      return "CPC";
    case "CALCULATED":
      return "Calculé CPC";
  }
}

/** Badge honnête : un club EA lié ≠ identité joueur EA vérifiée. */
export function eaIdentityBadge(kind: EaIdentityKind | null | undefined): {
  show: boolean;
  label: string;
  hint: string;
} {
  if (kind === "USERNAME_EQUALITY") {
    return {
      show: true,
      label: "Stats club EA liées",
      hint: "Rapprochement par pseudo — pas un id joueur EA vérifié.",
    };
  }
  return {
    show: false,
    label: "",
    hint: "Pas de stats EA liées — aucun chiffre inventé.",
  };
}

export function normalizeEaIdentityKind(value: unknown): EaIdentityKind {
  return value === "USERNAME_EQUALITY" ? "USERNAME_EQUALITY" : "NONE";
}
