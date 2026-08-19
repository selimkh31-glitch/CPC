import { TextInput, Text, View, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor="#666c74"
      className={cn(
        "h-12 rounded-xl border border-border bg-bg-elevated px-4 text-base text-fg",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, style, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      multiline
      textAlignVertical="top"
      placeholderTextColor="#666c74"
      className={cn("rounded-xl border border-border bg-bg-elevated px-4 py-3 text-base text-fg", className)}
      style={[{ minHeight: 80 }, style]}
      {...props}
    />
  );
}

export function Label({ children }: { children: string }) {
  return <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-fg-muted">{children}</Text>;
}
