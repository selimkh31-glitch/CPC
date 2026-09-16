import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";

/** Auth email/mot de passe via Supabase (section 1). */
export default function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: "clubproconnect://auth/callback" },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-center px-4">
        <View className="mb-10 items-center">
          <Logo size="lg" />
          <Text className="mt-3 text-center font-sans text-bodySmall text-fg-muted">
            Matchmaking temps réel pour EA SPORTS FC 27 Pro Clubs.
          </Text>
        </View>

        <View className="mb-5 flex-row border border-border bg-bg-elevated p-1" style={{ borderRadius: cpcTokens.radius.control }}>
          <Pressable
            onPress={() => setMode("signin")}
            className={cn("min-h-[44px] flex-1 items-center justify-center py-3", mode === "signin" && "bg-accent")}
            style={{ borderRadius: cpcTokens.radius.control }}
          >
            <Text className={cn("font-sans-bold", mode === "signin" ? "text-accent-fg" : "text-fg-muted")}>Connexion</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("signup")}
            className={cn("min-h-[44px] flex-1 items-center justify-center py-3", mode === "signup" && "bg-accent")}
            style={{ borderRadius: cpcTokens.radius.control }}
          >
            <Text className={cn("font-sans-bold", mode === "signup" ? "text-accent-fg" : "text-fg-muted")}>Inscription</Text>
          </Pressable>
        </View>

        <View className="gap-4">
          <View>
            <Label>Email</Label>
            <Input
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              placeholder="toi@exemple.com"
            />
          </View>
          <View>
            <Label>Mot de passe</Label>
            <Input
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
            />
          </View>

          <Button loading={loading} disabled={!email || password.length < 6} onPress={submit}>
            {mode === "signin" ? "Se connecter" : "Créer mon compte"}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
