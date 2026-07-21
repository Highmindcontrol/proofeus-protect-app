import * as Location from "expo-location";
import { supabase } from "@/supabase/client";

/**
 * Services Sécurité+ / Urgence de Proofeus Protect.
 *
 * Contient les fonctions utilisées par les écrans /urgence/* :
 *   - Gestion des contacts d'urgence (CRUD)
 *   - Gestion du cercle de confiance (créer, rejoindre, inviter des
 *     membres) — le mot commun est stocké en clair, consultable par
 *     tous les membres du cercle
 *   - Déclenchement d'une alerte (capture géoloc + envoi via API)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export type Cercle = {
  id: string;
  nom: string;
  mot_commun: string;
  mot_commun_indice: string | null;
  createur_id: string;
  code_invitation: string;
  created_at: string;
};

export type MembreCercle = {
  id: string;
  cercle_id: string;
  user_id: string | null;
  email: string;
  nom: string | null;
  role: "createur" | "membre";
  invite_at: string;
  accepte_at: string | null;
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
// Cercle de confiance
// ---------------------------------------------------------------------------

/**
 * Renvoie tous les cercles auxquels l'utilisateur appartient — comme
 * créateur ou comme membre invité/accepté.
 */
export async function listerMesCercles(): Promise<Cercle[]> {
  const { data, error } = await supabase.from("cercles").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as Cercle[];
}

/**
 * Crée un nouveau cercle dont l'utilisateur devient créateur, et
 * s'inscrit automatiquement comme membre.
 */
export async function creerCercle(input: {
  nom: string;
  motCommun: string;
  indice?: string;
}): Promise<Cercle> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  const email = session.session?.user?.email;
  if (!userId || !email) throw new Error("Vous devez être connecté.");

  const { data: cercle, error } = await supabase
    .from("cercles")
    .insert({
      nom: input.nom.trim(),
      mot_commun: input.motCommun.trim(),
      mot_commun_indice: input.indice?.trim() || null,
      createur_id: userId,
    })
    .select("*")
    .single();
  if (error || !cercle) throw new Error(error?.message ?? "Erreur création cercle.");

  // S'inscrire soi-même comme membre créateur
  await supabase.from("cercles_membres").insert({
    cercle_id: cercle.id,
    user_id: userId,
    email,
    nom: null,
    role: "createur",
    accepte_at: new Date().toISOString(),
  });

  return cercle as Cercle;
}

/**
 * Renomme le cercle et/ou change le mot commun (le créateur uniquement).
 */
export async function modifierCercle(
  cercleId: string,
  patch: Partial<Pick<Cercle, "nom" | "mot_commun" | "mot_commun_indice">>,
): Promise<void> {
  const { error } = await supabase.from("cercles").update(patch).eq("id", cercleId);
  if (error) throw new Error(error.message);
}

/**
 * Liste des membres d'un cercle donné.
 */
export async function listerMembresCercle(cercleId: string): Promise<MembreCercle[]> {
  const { data, error } = await supabase
    .from("cercles_membres")
    .select("*")
    .eq("cercle_id", cercleId)
    .order("invite_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MembreCercle[];
}

/**
 * Invite un membre par email dans un cercle.
 * Envoie un email via l'API web + insère la ligne dans cercles_membres.
 * Si le membre est déjà inscrit sur Proofeus, il est rattaché
 * automatiquement au cercle via son user_id. Sinon, la ligne existe
 * en attente et sera rattachée automatiquement à sa première connexion
 * (trigger auth.users → rattacher_cercles_a_nouveau_user).
 */
export async function inviterMembreCercle(
  cercleId: string,
  input: { email: string; nom?: string },
): Promise<MembreCercle> {
  const emailPropre = input.email.trim().toLowerCase();
  if (!emailPropre) throw new Error("L'email est obligatoire.");

  const { data: membre, error } = await supabase
    .from("cercles_membres")
    .insert({
      cercle_id: cercleId,
      email: emailPropre,
      nom: input.nom?.trim() || null,
      role: "membre",
    })
    .select("*")
    .single();
  if (error || !membre) throw new Error(error?.message ?? "Erreur invitation.");

  // Envoi de l'email d'invitation via l'API web (best effort)
  try {
    await fetch("https://proofeus.com/api/urgence/inviter-cercle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cercleId, membreId: membre.id }),
    });
  } catch {
    // silencieux — l'invitation existe en base même si l'email a échoué
  }

  return membre as MembreCercle;
}

export async function retirerMembreCercle(membreId: string): Promise<void> {
  const { error } = await supabase.from("cercles_membres").delete().eq("id", membreId);
  if (error) throw new Error(error.message);
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

  const position = await capturerPosition();

  const contacts = await listerContacts();
  const contactsActifs = contacts.filter((c) => c.actif);

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
