import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/lib/providers/AuthProvider";
import {
  type AppMode,
  appModeStorageKey,
  parseStoredAppMode,
} from "@/lib/appMode";

export type { AppMode };

interface AppModeContextValue {
  mode: AppMode | null;
  hydrated: boolean;
  selectedManagedClubId: string | null;
  setMode: (mode: AppMode) => void;
  setSelectedManagedClubId: (clubId: string | null) => void;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

/**
 * Mode Joueur / Manager — état UX/navigation PUR.
 * `mode` ne remplace et ne contourne AUCUNE permission. RLS / rôles club
 * restent la source de vérité. Persisté par user pour sauter la porte au relance.
 */
export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [mode, setModeState] = useState<AppMode | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [selectedManagedClubId, setSelectedManagedClubId] = useState<string | null>(null);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setSelectedManagedClubId(null);

    if (!userId) {
      setModeState(null);
      setHydrated(true);
      return;
    }

    setHydrated(false);
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(appModeStorageKey(userId));
        if (cancelled) return;
        setModeState(parseStoredAppMode(raw));
      } catch {
        if (!cancelled) setModeState(null);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setMode = useCallback(
    (next: AppMode) => {
      setModeState(next);
      if (!userId) return;
      SecureStore.setItemAsync(appModeStorageKey(userId), next).catch(() => {});
    },
    [userId]
  );

  const setSelectedManagedClubIdStable = useCallback((clubId: string | null) => setSelectedManagedClubId(clubId), []);

  return (
    <AppModeContext.Provider
      value={{
        mode,
        hydrated,
        selectedManagedClubId,
        setMode,
        setSelectedManagedClubId: setSelectedManagedClubIdStable,
      }}
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
