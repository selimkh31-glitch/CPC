import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { secureStoreAdapter } from "./secureStoreAdapter";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Client Supabase unique de l'app mobile — session persistée de façon sécurisée
 * (Keychain/Keystore via expo-secure-store), reconnexion automatique au lancement.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE requis pour exchangeCodeForSession() côté confirmation email
    // (app/auth/callback.tsx) — le flow "implicit" par défaut ne stocke pas
    // le code_verifier nécessaire à cet échange.
    flowType: "pkce",
  },
});

// Supabase recommande de piloter le auto-refresh du token selon l'état de
// l'app (pas de refresh inutile quand l'app est en arrière-plan).
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
