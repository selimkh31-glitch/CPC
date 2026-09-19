import { TextInput, Text, View, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

export function Input({ className, style, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor={cpcHex.disabled}
      className={cn("min-h-[44px] border border-border bg-bg-elevated px-4 font-sans text-body text-fg", className)}
      style={[{ borderRadius: cpcTokens.radius.input, height: cpcTokens.geometry.button, color: cpcHex.textPrimary }, style]}
      {...props}
    />
  );
}

export function Textarea({ className, style, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      multiline
      textAlignVertical="top"
      placeholderTextColor={cpcHex.disabled}
      className={cn("border border-border bg-bg-elevated px-4 py-3 font-sans text-body text-fg", className)}
      style={[{ minHeight: 80, borderRadius: cpcTokens.radius.input, color: cpcHex.textPrimary }, style]}
      {...props}
    />
  );
}

export function Label({ children }: { children: string }) {
  return (
    <Text
      className="mb-1.5 font-sans-bold text-caption uppercase text-fg-muted"
      style={{ letterSpacing: cpcTokens.font.letterSpacing.eyebrow }}
    >
      {children}
    </Text>
  );
}
