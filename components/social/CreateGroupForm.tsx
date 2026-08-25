import { useState } from "react";
import { View } from "react-native";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { useCreateGroup } from "@/lib/hooks/useGroups";
import { useAuth } from "@/lib/providers/AuthProvider";
import { CHAT_UX_COPY } from "@/lib/social";
import { toast } from "@/lib/toast";
import type { GroupRow } from "@/lib/types";

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "Public" },
  { value: "PRIVATE", label: "Privé" },
] as const;

/** Nouveau groupe — nom + visibilité. Pas un club. */
export function CreateGroupForm({ onCreated }: { onCreated?: (group: GroupRow) => void }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const mutation = useCreateGroup(session?.user.id ?? "");

  const submit = () => {
    if (!session || !name.trim()) {
      toast.error("Il faut un nom.");
      return;
    }
    mutation.mutate(
      { name: name.trim(), description: description.trim() || undefined, visibility },
      {
        onSuccess: (group) => {
          toast.success("C'est créé.");
          setName("");
          setDescription("");
          onCreated?.(group);
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  return (
    <View className="gap-4">
      <View>
        <Label>{CHAT_UX_COPY.groupName}</Label>
        <Input value={name} onChangeText={setName} placeholder={CHAT_UX_COPY.groupNamePlaceholder} />
      </View>
      <View>
        <Label>Une note (optionnel)</Label>
        <Textarea value={description} onChangeText={setDescription} placeholder="Qui vous êtes, quand vous jouez…" />
      </View>
      <View>
        <Label>Qui voit le groupe</Label>
        <ChipSelect
          single
          value={[visibility]}
          onChange={(v) => setVisibility((v[0] as "PUBLIC" | "PRIVATE") ?? "PUBLIC")}
          options={[...VISIBILITY_OPTIONS]}
        />
      </View>
      <Button loading={mutation.isPending} onPress={submit} className="min-h-[48px]">
        {CHAT_UX_COPY.newGroup}
      </Button>
    </View>
  );
}
