import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { USER_PUBLIC_COLUMNS, type UserRow } from "@/lib/types";

interface AuthContextValue {
  session: Session | null;
  profile: UserRow | null;
  loading: boolean;
  /** Échec réseau/RLS lors du fetch du profil — distinct de "profil inexistant"
   *  (qui doit mener à l'onboarding), voir app/_layout.tsx. */
  profileError: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Source de vérité de la session + du profil applicatif (table `users`).
 * Pilote le guard d'auth du layout racine (session -> onboarding -> tabs).
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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await fetchProfile(data.session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
        setProfileError(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, profileError, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
