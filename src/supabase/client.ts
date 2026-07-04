import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { secureStorage } from "./storage";

/**
 * Client Supabase pour l'app Proofeus Protect.
 *
 * Utilise la ANON key (jamais la service_role côté client mobile).
 * La session est persistée dans le Keychain iOS / EncryptedSharedPreferences
 * Android via expo-secure-store — les tokens ne touchent jamais le
 * stockage non chiffré.
 */

const url =
  Constants.expoConfig?.extra?.supabaseUrl ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://jqjqbhbdozndwsnbbqad.supabase.co";

const anonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "";

if (!anonKey) {
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY manquant — l'authentification ne fonctionnera pas.",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
