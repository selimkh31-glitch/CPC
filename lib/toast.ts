import { useSyncExternalStore } from "react";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let items: ToastItem[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function push(message: string, type: ToastItem["type"]) {
  const id = nextId++;
  items = [...items, { id, message, type }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 2800);
}

/** API globale de notifications toast (équivalent react-hot-toast pour RN). */
export const toast = {
  success: (message: string) => push(message, "success"),
  error: (message: string) => push(message, "error"),
  info: (message: string) => push(message, "info"),
};

export function useToastItems() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items
  );
}
