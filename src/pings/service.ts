import { supabase } from "@/supabase/client";

/**
 * Service de « pings de vérification » entre membres d'un cercle.
 *
 * Cas d'usage : Mamie envoie un ping à Léo depuis son app. Léo reçoit
 * une notification, valide avec Face ID en 2 secondes, Mamie voit
 * « ✓ Léo a confirmé ». Si Léo (le vrai) n'est pas au bout du fil,
 * aucune confirmation ne remonte → l'imposteur est démasqué en
 * silence.
 *
 * V0 (compatible Expo Go) : polling côté destinataire toutes les 5 s
 * pour détecter les pings entrants + notification locale. En V1
 * (dev-client) : push notifications distantes via Expo Push Service.
 */

export type StatutPing = "en_attente" | "confirme" | "refuse" | "expire";

export type Ping = {
  id: string;
  cercle_id: string;
  emetteur_id: string;
  destinataire_id: string;
  emetteur_prenom: string | null;
  message: string | null;
  statut: StatutPing;
  validation_face_id: boolean;
  created_at: string;
  repondu_at: string | null;
  expires_at: string;
};

/**
 * Envoie un ping de vérification à un membre du cercle.
 */
export async function envoyerPing(input: {
  cercleId: string;
  destinataireUserId: string;
  message?: string;
}): Promise<Ping> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error("Vous devez être connecté.");

  // Récupérer le prénom de l'émetteur pour personnaliser côté destinataire
  const { data: profil } = await supabase
    .from("protect_users")
    .select("prenom, nom")
    .eq("auth_id", userId)
    .maybeSingle();
  const prenom =
    profil?.prenom || profil?.nom
      ? `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim()
      : null;

  const { data, error } = await supabase
    .from("pings_verification")
    .insert({
      cercle_id: input.cercleId,
      emetteur_id: userId,
      destinataire_id: input.destinataireUserId,
      emetteur_prenom: prenom,
      message: input.message ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Erreur envoi ping.");
  return data as Ping;
}

/**
 * Liste les pings entrants encore en attente pour l'utilisateur
 * courant. Utilisé par le polling côté destinataire.
 *
 * Filtre CRUCIAL sur destinataire_id : sans ce filtre, les policies
 * RLS ramènent aussi les pings sortants de l'utilisateur (parce que
 * l'émetteur a le droit de les lire), et l'émetteur voit son propre
 * ping surgir chez lui comme s'il en était le destinataire.
 */
export async function listerPingsEntrants(): Promise<Ping[]> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return [];

  const maintenant = new Date().toISOString();
  const { data, error } = await supabase
    .from("pings_verification")
    .select("*")
    .eq("statut", "en_attente")
    .eq("destinataire_id", userId)
    .gt("expires_at", maintenant)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Ping[];
}

/**
 * Récupère l'état actuel d'un ping émis (pour que l'émetteur voie
 * si le destinataire a répondu, via polling ou refresh).
 */
export async function relirePing(pingId: string): Promise<Ping | null> {
  const { data } = await supabase
    .from("pings_verification")
    .select("*")
    .eq("id", pingId)
    .maybeSingle();
  return (data as Ping | null) ?? null;
}

/**
 * Le destinataire confirme le ping (après validation Face ID côté app).
 */
export async function confirmerPing(pingId: string): Promise<void> {
  const { error } = await supabase
    .from("pings_verification")
    .update({
      statut: "confirme",
      validation_face_id: true,
      repondu_at: new Date().toISOString(),
    })
    .eq("id", pingId);
  if (error) throw new Error(error.message);
}

/**
 * Le destinataire refuse le ping (bouton « Ce n'est pas moi »).
 */
export async function refuserPing(pingId: string): Promise<void> {
  const { error } = await supabase
    .from("pings_verification")
    .update({
      statut: "refuse",
      validation_face_id: false,
      repondu_at: new Date().toISOString(),
    })
    .eq("id", pingId);
  if (error) throw new Error(error.message);
}
