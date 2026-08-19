import { useState } from "react";
import { View } from "react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { useCreateGroup } from "@/lib/hooks/useGroups";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";
import type { GroupRow } from "@/lib/types";

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "Public (annuaire)" },
  { value: "PRIVATE", label: "Privé (sur invitation)" },
] as const;

/** Créer un groupe social (mission section 12) — même patron que CreateClubForm.tsx, jamais dupliqué à l'identique. */
export function CreateGroupForm({ onCreated }: { onCreated?: (group: GroupRow) => void }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const mutation = useCreateGroup(session?.user.id ?? "");

  const submit = () => {
    if (!session || !name.trim()) {
      toast.error("Le nom du groupe est requis.");
      return;
    }
    mutation.mutate(
      { name: name.trim(), description: description.trim() || undefined, visibility },
      {
        onSuccess: (group) => {
          toast.success("Groupe créé !");
          setName("");
          setDescription("");
          onCreated?.(group);
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un groupe</CardTitle>
      </CardHeader>
      <View className="gap-3">
        <View>
          <Label>Nom du groupe</Label>
          <Input value={name} onChangeText={setName} placeholder="Les habitués du jeudi soir" />
        </View>
        <View>
          <Label>Description (optionnel)</Label>
          <Textarea value={description} onChangeText={setDescription} placeholder="De quoi parle ce groupe ?" />
        </View>
        <View>
          <Label>Visibilité</Label>
          <ChipSelect
            single
            value={[visibility]}
            onChange={(v) => setVisibility((v[0] as "PUBLIC" | "PRIVATE") ?? "PUBLIC")}
            options={[...VISIBILITY_OPTIONS]}
          />
        </View>
        <Button loading={mutation.isPending} onPress={submit}>
          Créer le groupe
        </Button>
      </View>
    </Card>
  );
}
