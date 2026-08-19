import { Text, type TextProps } from "react-native";
import { cn } from "@/lib/utils";

type CinematicTextProps = TextProps & { className?: string };

/**
 * Échelle typographique Cinematic (Phase G.2 section 7) — formalise quelques
 * tailles réutilisables au-dessus des classes Tailwind déjà en place
 * (`font-display` = BarlowCondensed, `font-sans` = Inter, inchangés). `Label`
 * existe déjà (components/ui/Input.tsx) — réutilisé tel quel, pas dupliqué
 * ici. Rien ici n'est branché sur un écran existant : ces composants sont
 * prêts pour G.3-G.7, qui décideront où les adopter.
 */

/** Chiffre héros (score final RESULT, futur équivalent de l'OVR ClubProCard). */
export function DisplayXL({ className, ...props }: CinematicTextProps) {
  return <Text className={cn("font-display text-7xl text-fg", className)} {...props} />;
}

/** Titre d'écran cinématique / chiffre secondaire fort. */
export function DisplayLG({ className, ...props }: CinematicTextProps) {
  return <Text className={cn("font-display text-4xl text-fg", className)} {...props} />;
}

/** Équivalent de CardTitle mais hors contexte de carte (écrans plein-bleed). */
export function DisplayMD({ className, ...props }: CinematicTextProps) {
  return <Text className={cn("font-display text-2xl uppercase tracking-wide text-fg", className)} {...props} />;
}

/** Texte courant — alias sémantique du corps Inter déjà utilisé partout. */
export function Body({ className, ...props }: CinematicTextProps) {
  return <Text className={cn("font-sans text-base text-fg", className)} {...props} />;
}

/** Micro-texte (métadonnées, timestamps, légendes de liste). */
export function Caption({ className, ...props }: CinematicTextProps) {
  return <Text className={cn("font-sans text-xs text-fg-subtle", className)} {...props} />;
}
