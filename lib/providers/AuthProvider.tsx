import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { consumeAuthCallbackUrl } from "@/lib/auth/emailConfirm";
import { USER_PUBLIC_COLUMNS, type UserRow } from "@/lib/types";

interface AuthContextValue {
  session: Session | null;
  profile: UserRow | null;
  loading: boolean;
  /** Échec réseau/RLS lors du fetch du profil — distinct de "profil inexistant"
   *  (qui doit mener à l'onboarding), voir app/_layout.tsx. */
  profileError: boolean;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Source de vérité de la session + du profil applicatif (table `users`).
 * Pilote le guard d'auth du layout racine (session -> onboarding -> tabs).
 * Reprend la session au retour Mail (AppState active + deep link PKCE).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("users")
      .select(USER_PUBLIC_COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      // Échec réseau/RLS : NE PAS écraser un profil déjà connu avec `null`,
      // sinon le guard (app/_layout.tsx) renverrait à tort vers l'onboarding.
      setProfileError(true);
      return;
    }
    setProfileError(false);
    setProfile(data as unknown as UserRow | null);
  }, []);

  const applySession = useCallback(
    async (next: Session | null) => {
      setSession(next);
      if (next) {
        await fetchProfile(next.user.id);
        return;
      }
      setProfile(null);
      setProfileError(false);
    },
    [fetchProfile]
  );

  const refreshSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
    return data.session;
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;

    const syncFromStorage = async (markReady: boolean) => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await applySession(data.session);
      if (markReady && !cancelled) setLoading(false);
    };

    void syncFromStorage(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (cancelled) return;
      await applySession(newSession);
    });

    const onAppState = (state: AppStateStatus) => {
      if (state !== "active") return;
      void syncFromStorage(false);
    };
    const appSub = AppState.addEventListener("change", onAppState);

    const onUrl = ({ url }: { url: string }) => {
      void consumeAuthCallbackUrl(url);
    };
    const linkSub = Linking.addEventListener("url", onUrl);
    void Linking.getInitialURL().then((url) => {
      if (url) void consumeAuthCallbackUrl(url);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      appSub.remove();
      linkSub.remove();
    };
  }, [applySession]);

  const refreshProfile = useCallback(async () => {
    if (session) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const signOut = useCallback(async () => {
    // Auth only. Couper le LIVE = bouton Arrêter, pas la déconnexion.
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, profile, profileError, loading, refreshProfile, refreshSession, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
