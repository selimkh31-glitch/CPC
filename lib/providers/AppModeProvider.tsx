import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/lib/providers/AuthProvider";

export type AppMode = "PLAYER" | "CLUB";

interface AppModeContextValue {
  mode: AppMode;
  selectedManagedClubId: string | null;
  setMode: (mode: AppMode) => void;
  setSelectedManagedClubId: (clubId: string | null) => void;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

/**
 * CPC Foundation #1 — Mode Joueur / Mode Club (audit validé). État UX/navigation
 * PUR : `mode` ne remplace et ne contourne AUCUNE permission. `canManage`,
 * `isOwner`, les RLS, les Edge Functions restent l'unique source de vérité
 * d'autorisation — chaque écran Mode Club continue de revérifier le rôle réel
 * (club_members.role) exactement comme avant cette fondation. Passer mode=CLUB
 * n'ouvre l'accès à rien côté serveur ; ça ne fait que choisir quel arbre de
 * routes/tabs est monté (voir app/_layout.tsx, Stack.Protected).
 *
 * Monté à la racine, À L'INTÉRIEUR d'AuthProvider (a besoin de useAuth pour se
 * réinitialiser à la déconnexion/au changement de compte — voir plus bas).
 *
 * Défaut : chaque lancement démarre en MODE JOUEUR (pas de persistance V1,
 * volontairement — voir audit). `selectedManagedClubId` n'est jamais une
 * vérité persistante : les écrans qui le consomment (app/(club)/_layout.tsx)
 * doivent toujours le revalider contre les memberships réels avant de
 * l'utiliser — ce provider ne fait que le stocker, il ne le valide pas.
 */
export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [mode, setMode] = useState<AppMode>("PLAYER");
  const [selectedManagedClubId, setSelectedManagedClubId] = useState<string | null>(null);

  // Reset défensif : un changement de session (déconnexion, ou reconnexion
  // avec un compte différent sur le même appareil) ne doit jamais laisser un
  // mode CLUB / un club sélectionné hérités du compte précédent.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    setMode("PLAYER");
    setSelectedManagedClubId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setModeStable = useCallback((next: AppMode) => setMode(next), []);
  const setSelectedManagedClubIdStable = useCallback((clubId: string | null) => setSelectedManagedClubId(clubId), []);

  return (
    <AppModeContext.Provider
      value={{ mode, selectedManagedClubId, setMode: setModeStable, setSelectedManagedClubId: setSelectedManagedClubIdStable }}
    >
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode doit être utilisé dans <AppModeProvider>");
  return ctx;
}
