import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/lib/providers/AuthProvider";
import {
  type AppMode,
  MODE_SWITCH_APPLY_MS,
  MODE_SWITCH_MS,
  appModeStorageKey,
  parseStoredAppMode,
} from "@/lib/appMode";

export type { AppMode };

interface AppModeContextValue {
  mode: AppMode | null;
  hydrated: boolean;
  selectedManagedClubId: string | null;
  transitioningTo: AppMode | null;
  setMode: (mode: AppMode) => void;
  /** Menu hamburger — overlay puis autre shell. Porte / create-club gardent setMode. */
  switchMode: (mode: AppMode) => void;
  /** DEV / retest — efface le mode persisté pour réafficher la porte. */
  clearMode: () => void;
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
  const [transitioningTo, setTransitioningTo] = useState<AppMode | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const modeRef = useRef<AppMode | null>(null);
  const transitioningRef = useRef<AppMode | null>(null);

  const userId = session?.user.id ?? null;
  modeRef.current = mode;
  transitioningRef.current = transitioningTo;

  const clearSwitchTimers = useCallback(() => {
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearSwitchTimers();
  }, [clearSwitchTimers]);

  useEffect(() => {
    let cancelled = false;
    setSelectedManagedClubId(null);
    clearSwitchTimers();
    setTransitioningTo(null);

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
  }, [userId, clearSwitchTimers]);

  const persistMode = useCallback(
    (next: AppMode) => {
      setModeState(next);
      if (!userId) return;
      SecureStore.setItemAsync(appModeStorageKey(userId), next).catch(() => {});
    },
    [userId]
  );

  const setMode = useCallback(
    (next: AppMode) => {
      persistMode(next);
    },
    [persistMode]
  );

  const switchMode = useCallback(
    (next: AppMode) => {
      if (transitioningRef.current === next) return;
      if (modeRef.current === next && !transitioningRef.current) return;

      clearSwitchTimers();
      setTransitioningTo(next);

      const apply = setTimeout(() => {
        persistMode(next);
      }, MODE_SWITCH_APPLY_MS);

      const done = setTimeout(() => {
        setTransitioningTo(null);
      }, MODE_SWITCH_MS);

      timersRef.current = [apply, done];
    },
    [clearSwitchTimers, persistMode]
  );

  const clearMode = useCallback(() => {
    clearSwitchTimers();
    setTransitioningTo(null);
    setModeState(null);
    setSelectedManagedClubId(null);
    if (!userId) return;
    SecureStore.deleteItemAsync(appModeStorageKey(userId)).catch(() => {});
  }, [userId, clearSwitchTimers]);

  const setSelectedManagedClubIdStable = useCallback((clubId: string | null) => setSelectedManagedClubId(clubId), []);

  return (
    <AppModeContext.Provider
      value={{
        mode,
        hydrated,
        selectedManagedClubId,
        transitioningTo,
        setMode,
        switchMode,
        clearMode,
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
