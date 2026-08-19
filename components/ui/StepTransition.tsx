import { AnimatePresence, MotiView } from "moti";

type TransitionKind = "fade" | "slide" | "scale";

const VARIANTS: Record<TransitionKind, { from: object; animate: object; exit: object }> = {
  fade: { from: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slide: { from: { opacity: 0, translateX: 24 }, animate: { opacity: 1, translateX: 0 }, exit: { opacity: 0, translateX: -24 } },
  scale: { from: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 } },
};

/**
 * Transition entre états d'un même écran (Phase G.2 section 5) — le besoin
 * cible étant CHECK-IN -> LIVE -> TERMINATE -> RESULT (audit G.1 section J).
 * `stepKey` doit être une clé unique par état affiché (typiquement le `step`
 * React local d'un écran) pour qu'AnimatePresence détecte l'entrée/sortie.
 * Durée courte volontairement (220ms, `exitBeforeEnter`) : "fluide, rapide,
 * maîtrisée" — jamais un effet gadget (consigne G.2 section 5).
 *
 * Composant neuf, non branché sur `MatchCheckinPanel.tsx` dans cette phase
 * (ses transitions de step restent des `return` conditionnels instantanés,
 * inchangés) — à adopter explicitement dans les phases suivantes.
 */
export function StepTransition({
  stepKey,
  kind = "fade",
  children,
}: {
  stepKey: string;
  kind?: TransitionKind;
  children: React.ReactNode;
}) {
  const variant = VARIANTS[kind];
  return (
    <AnimatePresence exitBeforeEnter>
      <MotiView
        key={stepKey}
        from={variant.from}
        animate={variant.animate}
        exit={variant.exit}
        transition={{ type: "timing", duration: 220 }}
      >
        {children}
      </MotiView>
    </AnimatePresence>
  );
}
