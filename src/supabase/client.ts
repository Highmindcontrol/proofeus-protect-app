import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

/**
 * Client Supabase pour l'app Proofeus Protect.
 *
 * Utilise la ANON key (pas la service_role — jamais côté client mobile).
 * URL + anon key à mettre dans le fichier .env local et exposées via
 * app.json extra ou expo-constants.
 *
 * V0 : credentials embarqués en dur pour le développement. À remplacer
 * par des variables EAS Secrets dès qu'on prépare les builds prod.
 */

const url =
  Constants.expoConfig?.extra?.supabaseUrl ??
  "https://jqjqbhbdozndwsnbbqad.supabase.co";

// Anon key sera injectée via app.config.js quand la clé publique sera
// prête. Pour V0 (dev seul, données non sensibles côté app), une clé
// factice suffit — remplacer par la vraie SUPABASE_ANON_KEY.
const anonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
