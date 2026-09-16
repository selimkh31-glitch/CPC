import { View } from "react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  placeholder,
  sendLabel,
  disabled,
  loading,
  bottomInset,
}: {
  value: string;
  onChangeText: (next: string) => void;
  onSend: () => void;
  placeholder: string;
  sendLabel: string;
  disabled?: boolean;
  loading?: boolean;
  bottomInset?: number;
}) {
  return (
    <View
      className="flex-row items-center gap-2 border-t border-border bg-bg px-3 pt-3"
      style={{ paddingBottom: (bottomInset ?? 0) + 12 }}
    >
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        className="min-h-[44px] flex-1"
        onSubmitEditing={onSend}
        returnKeyType="send"
        accessibilityLabel={placeholder}
      />
      <Button
        className="min-h-[44px] px-5"
        disabled={disabled || !value.trim()}
        loading={loading}
        onPress={onSend}
        accessibilityLabel={sendLabel}
      >
        {sendLabel}
      </Button>
    </View>
  );
}
