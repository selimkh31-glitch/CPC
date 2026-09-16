import { TextInput, View, type TextInputProps } from "react-native";
import { Search } from "lucide-react-native";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";
import { cn } from "@/lib/utils";

export function SearchInput({ className, style, ...props }: TextInputProps & { className?: string }) {
  return (
    <View
      className={cn("min-h-[44px] flex-row items-center border border-border bg-bg-elevated px-3", className)}
      style={[{ borderRadius: cpcTokens.radius.input }, style]}
    >
      <Search size={cpcTokens.icon.sm} color={cpcHex.textMuted} />
      <TextInput
        placeholderTextColor={cpcHex.disabled}
        className="ml-2 min-h-[44px] flex-1 font-sans text-body text-fg"
        accessibilityRole="search"
        {...props}
      />
    </View>
  );
}
