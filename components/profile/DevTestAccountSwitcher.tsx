import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { toast } from "@/lib/toast";
import { switchDevTestAccount } from "@/lib/devTestAccountSwitch";
import {
  CPC_DEV_TEST_ACCOUNTS,
  cpcDevTestPassword,
  type CpcDevTestEmail,
} from "@/lib/devTestAccounts";

/**
 * Switcher Comptes test — Profil (et Club en __DEV__). Jamais en production.
 * Sign-in email/mot de passe existant. Pas de wipe DB. Pas de coupe LIVE.
 */
export function DevTestAccountSwitcher() {
  const [busy, setBusy] = useState<CpcDevTestEmail | null>(null);

  if (typeof __DEV__ !== "undefined" && !__DEV__) return null;
  if (CPC_DEV_TEST_ACCOUNTS.length === 0) return null;

  const switchTo = async (email: CpcDevTestEmail) => {
    const password = cpcDevTestPassword();
    if (!password || busy) return;
    setBusy(email);
    try {
      Haptics.selectionAsync();
      await switchDevTestAccount(email);
      toast.success(`Connecté : ${email}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connexion test impossible.";
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="mb-8">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Comptes test</Text>
      <Text className="mb-3 text-sm text-fg-subtle">__DEV__ seulement. La base n&apos;est pas touchée.</Text>
      <View className="gap-1">
        {CPC_DEV_TEST_ACCOUNTS.map((account) => (
          <Pressable
            key={account.email}
            accessibilityRole="button"
            accessibilityLabel={`Compte test ${account.label}`}
            disabled={busy !== null}
            onPress={() => switchTo(account.email)}
            className="min-h-[48px] justify-center py-1 active:opacity-80"
          >
            <Text className="text-base font-bold text-accent">
              {busy === account.email ? "Connexion…" : account.label}
            </Text>
            <Text className="text-xs text-fg-subtle">
              {account.username} · {account.email}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
