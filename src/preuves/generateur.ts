import * as Crypto from "expo-crypto";
import { supabase } from "@/supabase/client";

/**
 * Génération de preuves d'humanité éphémères pour Proofeus Protect.
 *
 * Sprint 5 — QR code éphémère signé (V1 pragmatique).
 *
 * Chaque preuve = un code aléatoire de 32 caractères hex (128 bits
 * d'entropie), enregistré dans public.preuves_ephemeres avec :
 *   - owner_id : l'utilisateur authentifié
 *   - expires_at : 60 secondes après création
 *   - contexte : présence, visio, appel, etc.
 *
 * Le QR affiché à l'interlocuteur encode l'URL publique :
 *   https://proofeus.com/verify/{code}
 *
 * Le vérificateur scanne, atterrit sur la page /verify qui marque la
 * preuve comme consommée (one-shot) et affiche « humain vérifié ».
 *
 * V2 (post-Ataraxis IA) : passer à un vrai JWT signé côté device via
 * Secure Enclave + Web Crypto server-side. Pour la V1, le code
 * aléatoire + vérification serveur (source de vérité) suffit — le code
 * est unpredictable et one-shot.
 */

export type Contexte =
  | "presence"
  | "visio"
  | "appel"
  | "signature"
  | "web"
  | "autre";

export type Preuve = {
  id: string;
  code: string;
  contexte: Contexte;
  expiresAt: Date;
  createdAt: Date;
  urlVerification: string;
};

const DUREE_VIE_MS = 60_000; // 60 secondes
const URL_BASE = "https://proofeus.com/verify/";

/**
 * Génère un code aléatoire URL-safe de 32 caractères hex (128 bits).
 */
async function genererCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Crée une nouvelle preuve éphémère dans Supabase et retourne les
 * données nécessaires à l'affichage du QR code.
 */
export async function creerPreuve(contexte: Contexte = "presence"): Promise<Preuve> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) {
    throw new Error("Vous devez être connecté pour émettre une preuve.");
  }

  const code = await genererCode();
  const maintenant = new Date();
  const expiresAt = new Date(maintenant.getTime() + DUREE_VIE_MS);

  const { data, error } = await supabase
    .from("preuves_ephemeres")
    .insert({
      owner_id: userId,
      code,
      contexte,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, code, contexte, expires_at, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Impossible de créer la preuve.");
  }

  return {
    id: data.id,
    code: data.code,
    contexte: data.contexte as Contexte,
    expiresAt: new Date(data.expires_at),
    createdAt: new Date(data.created_at),
    urlVerification: `${URL_BASE}${data.code}`,
  };
}

/**
 * Vérifie si une preuve a été consommée côté serveur — utile pour
 * afficher un retour dans l'app quand l'interlocuteur scanne le QR.
 * Retourne null si la preuve n'existe pas.
 */
export async function statutPreuve(
  code: string,
): Promise<{ consumedAt: Date | null; expiresAt: Date } | null> {
  const { data } = await supabase
    .from("preuves_ephemeres")
    .select("consumed_at, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!data) return null;
  return {
    consumedAt: data.consumed_at ? new Date(data.consumed_at) : null,
    expiresAt: new Date(data.expires_at),
  };
}
