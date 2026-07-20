import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { supabase } from "@/supabase/client";

/**
 * Services Sécurité+ / Urgence de Proofeus Protect.
 *
 * Contient les fonctions utilisées par les écrans /urgence/* :
 *   - Gestion des contacts d'urgence (CRUD)
 *   - Gestion des codes de sécurité (hash côté device)
 *   - Déclenchement d'une alerte (capture géoloc + envoi via API)
 */

export type ContactUrgence = {
  id?: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  relation: string | null;
  ordre: number;
  notifie_par_email: boolean;
  notifie_par_sms: boolean;
  actif: boolean;
};

export type CodesSecurite = {
  mot_rassurant_indice: string | null;
  mot_contrainte_indice: string | null;
  a_mot_rassurant: boolean;
  a_mot_contrainte: boolean;
  a_pin: boolean;
};

export type TypeDeclenchement =
  | "bouton_manuel"
  | "mot_contrainte"
  | "timer"
  | "boutons_physiques"
  | "sos";

// ---------------------------------------------------------------------------
// Contacts d'urgence
// ---------------------------------------------------------------------------

export async function listerContacts(): Promise<ContactUrgence[]> {
  const { data, error } = await supabase
    .from("contacts_urgence")
    .select("*")
    .order("ordre", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContactUrgence[];
}

export async function ajouterContact(
  contact: Omit<ContactUrgence, "id">,
): Promise<ContactUrgence> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Vous devez être connecté.");

  const { data, error } = await supabase
    .from("contacts_urgence")
    .insert({ ...contact, owner_id: userId })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Erreur ajout contact.");
  return data as ContactUrgence;
}

export async function supprimerContact(id: string): Promise<void> {
  const { error } = await supabase.from("contacts_urgence").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Codes de sécurité
// ---------------------------------------------------------------------------

/**
 * Hash un mot (SHA-256) — la comparaison se fait côté device en local
 * pour vérifier si un mot saisi correspond au mot rassurant ou au mot
 * de contrainte. Le mot en clair ne quitte jamais l'app.
 */
async function hashMot(mot: string): Promise<string> {
  const normalise = mot.trim().toLowerCase();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalise);
}

export async function lireCodesSecurite(): Promise<CodesSecurite | null> {
  const { data } = await supabase
    .from("codes_securite")
    .select("mot_rassurant_hash, mot_rassurant_indice, mot_contrainte_hash, mot_contrainte_indice, code_pin_hash")
    .maybeSingle();
  if (!data) return null;
  return {
    mot_rassurant_indice: data.mot_rassurant_indice,
    mot_contrainte_indice: data.mot_contrainte_indice,
    a_mot_rassurant: Boolean(data.mot_rassurant_hash),
    a_mot_contrainte: Boolean(data.mot_contrainte_hash),
    a_pin: Boolean(data.code_pin_hash),
  };
}

export async function definirCodesSecurite(input: {
  motRassurant: string;
  motRassurantIndice: string;
  motContrainte: string;
  motContrainteIndice: string;
  pin?: string;
}): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Vous devez être connecté.");

  if (input.motRassurant.trim().toLowerCase() === input.motContrainte.trim().toLowerCase()) {
    throw new Error("Le mot rassurant et le mot de contrainte doivent être différents.");
  }

  const [motRassurantHash, motContrainteHash] = await Promise.all([
    hashMot(input.motRassurant),
    hashMot(input.motContrainte),
  ]);
  const pinHash = input.pin ? await hashMot(input.pin) : null;

  const { error } = await supabase.from("codes_securite").upsert(
    {
      owner_id: userId,
      mot_rassurant_hash: motRassurantHash,
      mot_rassurant_indice: input.motRassurantIndice.trim() || null,
      mot_contrainte_hash: motContrainteHash,
      mot_contrainte_indice: input.motContrainteIndice.trim() || null,
      code_pin_hash: pinHash,
      actif: true,
    },
    { onConflict: "owner_id" },
  );
  if (error) throw new Error(error.message);
}

/**
 * Vérifie un mot saisi contre le mot rassurant et le mot de contrainte
 * stockés (hashés). Retourne le type détecté, ou null si aucun match.
 * Utilisé lors d'une demande de code sous menace.
 */
export async function verifierMotSaisi(
  mot: string,
): Promise<"rassurant" | "contrainte" | null> {
  const { data } = await supabase
    .from("codes_securite")
    .select("mot_rassurant_hash, mot_contrainte_hash")
    .maybeSingle();
  if (!data) return null;
  const h = await hashMot(mot);
  if (h === data.mot_contrainte_hash) return "contrainte";
  if (h === data.mot_rassurant_hash) return "rassurant";
  return null;
}

// ---------------------------------------------------------------------------
// Déclenchement d'alerte
// ---------------------------------------------------------------------------

async function capturerPosition(): Promise<{
  latitude?: number;
  longitude?: number;
  precisionMetres?: number;
}> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return {};
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      precisionMetres: pos.coords.accuracy ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function declencherAlerte(input: {
  type: TypeDeclenchement;
  message?: string;
}): Promise<{ alerteId: string; contactsNotifies: number }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Vous devez être connecté.");

  // Position (best effort — n'échoue pas si permission refusée)
  const position = await capturerPosition();

  // Snapshot des contacts au moment T
  const contacts = await listerContacts();
  const contactsActifs = contacts.filter((c) => c.actif);

  // Créer la ligne alerte
  const { data: alerte, error: aErr } = await supabase
    .from("alertes_declenchees")
    .insert({
      owner_id: userId,
      type_declenchement: input.type,
      latitude: position.latitude,
      longitude: position.longitude,
      precision_metres: position.precisionMetres,
      message_utilisateur: input.message ?? null,
      contacts_notifies: contactsActifs,
      statut: "active",
    })
    .select("id")
    .single();

  if (aErr || !alerte) throw new Error(aErr?.message ?? "Erreur création alerte.");

  // Envoyer les notifications via l'API web (email + SMS via Brevo)
  const url = `https://proofeus.com/api/urgence/declencher`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        alerteId: alerte.id,
        userId,
        type: input.type,
        message: input.message ?? null,
        position,
        contacts: contactsActifs,
      }),
    });
  } catch {
    // silencieux — la ligne alerte est créée, l'envoi de mails est
    // idempotent et pourra être rejoué
  }

  return { alerteId: alerte.id, contactsNotifies: contactsActifs.length };
}

export async function leverAlerte(alerteId: string): Promise<void> {
  const { error } = await supabase
    .from("alertes_declenchees")
    .update({
      statut: "levee",
      levee_at: new Date().toISOString(),
      levee_par: "utilisateur",
    })
    .eq("id", alerteId);
  if (error) throw new Error(error.message);
}
