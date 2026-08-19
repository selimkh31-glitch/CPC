import * as SecureStore from "expo-secure-store";

/**
 * Adaptateur de stockage Supabase basé sur expo-secure-store (Keychain iOS /
 * Keystore Android). Le Keychain iOS limite chaque valeur à ~2048 octets ;
 * une session Supabase (access + refresh token) peut dépasser cette taille,
 * donc on découpe en chunks numérotés, comme recommandé par la doc Supabase.
 */
const CHUNK_SIZE = 1800;

function chunkKey(key: string, index: number) {
  return `${key}_${index}`;
}

export const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (!chunkCountRaw) {
      // Rétro-compat : valeur simple non chunkée.
      return SecureStore.getItemAsync(key);
    }
    const chunkCount = parseInt(chunkCountRaw, 10);
    const parts: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
    await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length));
    // Nettoie l'ancienne valeur simple si elle existait.
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },

  async removeItem(key: string): Promise<void> {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunkCountRaw) {
      const chunkCount = parseInt(chunkCountRaw, 10);
      await Promise.all(
        Array.from({ length: chunkCount }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i)))
      );
      await SecureStore.deleteItemAsync(`${key}_chunks`);
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};
