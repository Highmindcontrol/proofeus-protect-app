import * as SecureStore from "expo-secure-store";

/**
 * Adaptateur Storage pour Supabase Auth qui persiste la session dans
 * le Keychain iOS / EncryptedSharedPreferences Android. Fondation
 * sécurisée : les tokens ne sont JAMAIS dans AsyncStorage (accessible
 * en clair), toujours dans le hardware sécurisé de l'appareil.
 */

const isBrowser = typeof globalThis?.window !== "undefined";

export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isBrowser) return null;
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isBrowser) return;
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn("[secureStorage] setItem failed", e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (isBrowser) return;
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn("[secureStorage] removeItem failed", e);
    }
  },
};
