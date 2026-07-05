import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Adaptateur Storage pour Supabase Auth qui persiste la session dans
 * le Keychain iOS / EncryptedSharedPreferences Android via chunking.
 *
 * SecureStore d'iOS impose une limite d'environ 2048 caractères par
 * valeur — or le JSON de session Supabase (access_token JWT + refresh
 * token + metadata) dépasse largement cette limite (~3-4 KB).
 *
 * Sans chunking, setItem échoue silencieusement, la session est
 * perdue et le serveur reçoit un JWT nul → auth.uid() = NULL côté
 * Postgres → toutes les policies RLS refusent.
 *
 * Ce module découpe la valeur en fragments de 1800 caractères stockés
 * sous les clés `key_0`, `key_1`, ..., et un compteur sous `key_count`.
 * La lecture réassemble transparent pour Supabase.
 */

const CHUNK_SIZE = 1800; // Marge confortable sous les 2048 max iOS
// react-native-web pollue `globalThis.window` même en mode natif iOS/Android,
// donc `typeof window !== "undefined"` est un faux positif → utiliser Platform.
const isWeb = Platform.OS === "web";

// Log au chargement du module — sert de canari pour vérifier que Metro
// a bien rebundlé la nouvelle version après un git pull.
console.log(
  "[secureStorage] module loaded — chunking v3, Platform.OS =",
  Platform.OS,
);

async function clearChunks(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${key}_count`);
  if (countStr) {
    const count = parseInt(countStr, 10);
    if (!isNaN(count)) {
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => {});
      }
    }
    await SecureStore.deleteItemAsync(`${key}_count`).catch(() => {});
  }
  // Ancien format monolithique éventuel
  await SecureStore.deleteItemAsync(key).catch(() => {});
}

export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isWeb) return null;
    try {
      const countStr = await SecureStore.getItemAsync(`${key}_count`);
      console.log(
        "[secureStorage] getItem",
        key,
        "→ countStr =",
        countStr,
      );
      if (!countStr) {
        // Fallback ancien format monolithique
        const mono = await SecureStore.getItemAsync(key);
        console.log(
          "[secureStorage] getItem",
          key,
          "→ monolithique length =",
          mono?.length ?? 0,
        );
        return mono;
      }
      const count = parseInt(countStr, 10);
      if (isNaN(count) || count <= 0) return null;

      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(`${key}_${i}`);
        if (part === null) {
          console.warn(
            "[secureStorage] chunk manquant",
            `${key}_${i}`,
            "→ nettoyage",
          );
          await clearChunks(key);
          return null;
        }
        parts.push(part);
      }
      const joined = parts.join("");
      console.log(
        "[secureStorage] getItem",
        key,
        "→ reassembled length =",
        joined.length,
      );
      return joined;
    } catch (e) {
      console.warn("[secureStorage] getItem failed", e);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (isWeb) return;
    console.log(
      "[secureStorage] setItem",
      key,
      "→ value length =",
      value.length,
    );
    try {
      // Nettoyer d'abord tout ce qui pourrait exister sous cette clé
      await clearChunks(key);

      // Découper en chunks
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }

      // Persister chaque chunk sous sa clé indexée
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]);
      }
      await SecureStore.setItemAsync(`${key}_count`, chunks.length.toString());
      console.log(
        "[secureStorage] setItem",
        key,
        "→ persisted",
        chunks.length,
        "chunks",
      );
    } catch (e) {
      console.warn("[secureStorage] setItem failed", e);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (isWeb) return;
    try {
      await clearChunks(key);
    } catch (e) {
      console.warn("[secureStorage] removeItem failed", e);
    }
  },
};
