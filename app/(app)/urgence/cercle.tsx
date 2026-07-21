import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertBox, Button, Card, Field } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import {
  creerCercle,
  inviterMembreCercle,
  listerMembresCercle,
  listerMesCercles,
  modifierCercle,
  retirerMembreCercle,
  type Cercle,
  type MembreCercle,
} from "@/urgence/service";
import {
  formaterCode,
  genererCodeTotp,
  secondesAvantRotation,
  verifierCodeTotp,
} from "@/totp/service";
import {
  envoyerPing,
  listerPingsEntrants,
  relirePing,
  type Ping,
} from "@/pings/service";
import { PingRecuModal } from "@/components/PingRecuModal";

/**
 * Écran « Mon cercle de confiance ».
 *
 * Doctrine : le mot commun est un secret PARTAGÉ entre les membres du
 * cercle, consultable en clair par chacun d'eux depuis son application.
 * Cas d'usage : Mamie reçoit un appel de son « petit-fils » — elle
 * demande le mot du cercle. Le vrai le sait, l'imposteur non.
 *
 * L'écran présente trois états :
 *   1. Aucun cercle → formulaire de création
 *   2. Cercle existant dont je suis créateur → nom + mot + liste
 *      membres avec ajout / retrait + modification
 *   3. Cercle existant dont je suis membre → nom + mot + liste
 *      membres en lecture seule
 */

export default function CercleScreen() {
  const router = useRouter();
  const [cercles, setCercles] = useState<Cercle[]>([]);
  const [membres, setMembres] = useState<MembreCercle[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  // Formulaire création
  const [nomCercle, setNomCercle] = useState("");
  const [motCommun, setMotCommun] = useState("");
  const [indice, setIndice] = useState("");

  // Formulaire invitation
  const [invitAjout, setInvitAjout] = useState(false);
  const [invitEmail, setInvitEmail] = useState("");
  const [invitNom, setInvitNom] = useState("");

  // Édition
  const [enEdition, setEnEdition] = useState(false);
  const [editNom, setEditNom] = useState("");
  const [editMot, setEditMot] = useState("");
  const [editIndice, setEditIndice] = useState("");

  // TOTP — code rotatif à afficher + zone de vérification d'un code lu
  const [codeTotp, setCodeTotp] = useState<string>("");
  const [secondesRestantes, setSecondesRestantes] = useState<number>(60);
  const [codeAVerifier, setCodeAVerifier] = useState<string>("");
  const [resultatVerification, setResultatVerification] = useState<
    "ok" | "ko" | null
  >(null);

  // Pings entrants (polling toutes les 5 s) + ping sortant en attente
  const [pingEntrant, setPingEntrant] = useState<Ping | null>(null);
  const [pingSortant, setPingSortant] = useState<Ping | null>(null);
  const [enEnvoiPing, setEnEnvoiPing] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const c = await listerMesCercles();
      setCercles(c);
      if (c[0]) {
        setMembres(await listerMembresCercle(c[0].id));
        setEditNom(c[0].nom);
        setEditMot(c[0].mot_commun);
        setEditIndice(c[0].mot_commun_indice ?? "");
      } else {
        setMembres([]);
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Ticker TOTP — recalcule le code toutes les secondes tant que le
  // cercle est affiché. Le code lui-même ne change que toutes les 60s
  // mais on met à jour le compteur pour un affichage fluide.
  useEffect(() => {
    const secret = cercles[0]?.totp_secret;
    if (!secret) {
      setCodeTotp("");
      setSecondesRestantes(60);
      return;
    }
    const maj = () => {
      setCodeTotp(genererCodeTotp(secret));
      setSecondesRestantes(secondesAvantRotation());
    };
    maj();
    const t = setInterval(maj, 1000);
    return () => clearInterval(t);
  }, [cercles]);

  function verifierCode() {
    const secret = cercles[0]?.totp_secret;
    if (!secret) return;
    const ok = verifierCodeTotp(secret, codeAVerifier);
    setResultatVerification(ok ? "ok" : "ko");
    if (ok) {
      setTimeout(() => {
        setCodeAVerifier("");
        setResultatVerification(null);
      }, 3000);
    }
  }

  // Polling des pings entrants — toutes les 5 s tant que l'écran cercle
  // est ouvert (V0 Expo Go). En V1 dev-client on remplacera par push
  // notifications distantes.
  useEffect(() => {
    let annule = false;
    async function poll() {
      const pings = await listerPingsEntrants();
      if (annule) return;
      // On affiche le plus récent qui n'est pas déjà consommé
      if (pings.length > 0 && !pingEntrant) {
        setPingEntrant(pings[0]);
      }
    }
    void poll();
    const t = setInterval(poll, 5000);
    return () => {
      annule = true;
      clearInterval(t);
    };
  }, [pingEntrant]);

  // Polling du ping sortant en attente pour voir la réponse
  useEffect(() => {
    if (!pingSortant || pingSortant.statut !== "en_attente") return;
    const t = setInterval(async () => {
      const maj = await relirePing(pingSortant.id);
      if (maj && maj.statut !== "en_attente") {
        setPingSortant(maj);
        clearInterval(t);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [pingSortant]);

  async function surPing(destinataireUserId: string) {
    const cercle = cercles[0];
    if (!cercle) return;
    setEnEnvoiPing(true);
    try {
      const ping = await envoyerPing({
        cercleId: cercle.id,
        destinataireUserId,
      });
      setPingSortant(ping);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnEnvoiPing(false);
    }
  }

  async function surCreation() {
    setErreur(null);
    if (!nomCercle.trim() || !motCommun.trim()) {
      setErreur("Le nom du cercle et le mot commun sont obligatoires.");
      return;
    }
    if (motCommun.trim().length < 3) {
      setErreur("Le mot commun doit contenir au moins 3 caractères.");
      return;
    }
    try {
      await creerCercle({
        nom: nomCercle,
        motCommun,
        indice: indice.trim() || undefined,
      });
      setNomCercle("");
      setMotCommun("");
      setIndice("");
      setSucces("Cercle créé. Invitez maintenant les autres membres.");
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  async function surInvitation() {
    setErreur(null);
    const cercle = cercles[0];
    if (!cercle) return;
    if (!invitEmail.trim()) {
      setErreur("Email obligatoire.");
      return;
    }
    try {
      await inviterMembreCercle(cercle.id, {
        email: invitEmail,
        nom: invitNom || undefined,
      });
      setInvitEmail("");
      setInvitNom("");
      setInvitAjout(false);
      setSucces(
        `Invitation envoyée. Si cette personne est déjà inscrite, elle voit immédiatement le cercle dans son application. Sinon, elle sera rattachée à sa première connexion.`,
      );
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  function surRetrait(m: MembreCercle) {
    Alert.alert(
      "Retirer ce membre ?",
      `${m.nom ?? m.email} ne pourra plus consulter le mot du cercle.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: async () => {
            try {
              await retirerMembreCercle(m.id);
              await charger();
            } catch (e) {
              setErreur(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  }

  async function surSauvegarde() {
    const cercle = cercles[0];
    if (!cercle) return;
    setErreur(null);
    try {
      await modifierCercle(cercle.id, {
        nom: editNom.trim(),
        mot_commun: editMot.trim(),
        mot_commun_indice: editIndice.trim() || null,
      });
      setEnEdition(false);
      setSucces("Cercle modifié. Tous les membres voient la mise à jour.");
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  const cercle = cercles[0];
  const monEmail = membres.find(
    (m) => m.role === "createur" && m.cercle_id === cercle?.id,
  );
  const suisCreateur = cercle && monEmail !== undefined;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Retour</Text>
          </Pressable>
          <Text style={typography.eyebrow}>Sécurité+ · Cercle</Text>
          <Text style={[typography.title, styles.title]}>
            Le mot de votre cercle.
          </Text>
          <Text style={styles.subtitle}>
            Un secret partagé entre les membres de votre cercle de confiance.
            Sert à démasquer un imposteur au téléphone.
          </Text>
        </View>

        {erreur ? <AlertBox variant="error" message={erreur} /> : null}
        {succes ? <AlertBox variant="success" message={succes} /> : null}

        {chargement ? (
          <Text style={styles.chargement}>Chargement…</Text>
        ) : !cercle ? (
          // ---------------- Aucun cercle : formulaire création ----------------
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Créer votre cercle</Text>
              <Text style={styles.hint}>
                Choisissez un nom (« Famille », « Chez nous », « Les proches »)
                et un mot commun que vous partagerez ensuite avec vos proches
                membres du cercle.
              </Text>
              <Field
                label="Nom du cercle"
                value={nomCercle}
                onChangeText={setNomCercle}
                placeholder="ex : Famille"
                autoCapitalize="words"
              />
              <Field
                label="Mot commun du cercle"
                value={motCommun}
                onChangeText={setMotCommun}
                placeholder="ex : jasmin"
                autoCapitalize="none"
              />
              <Field
                label="Indice public (optionnel)"
                value={indice}
                onChangeText={setIndice}
                placeholder="ex : la fleur préférée de Mamie"
                autoCapitalize="none"
              />
              <Button label="Créer mon cercle" onPress={surCreation} variant="primary" />
            </Card>
            <AlertBox
              variant="info"
              message="Une fois le cercle créé, vous inviterez les autres membres par email. Ils verront le mot dans leur application dès qu'ils rejoindront le cercle."
            />
          </>
        ) : enEdition ? (
          // ---------------- Édition du cercle ----------------
          <Card style={styles.card}>
            <Text style={typography.eyebrow}>Modifier le cercle</Text>
            <Field label="Nom" value={editNom} onChangeText={setEditNom} />
            <Field label="Mot commun" value={editMot} onChangeText={setEditMot} autoCapitalize="none" />
            <Field label="Indice" value={editIndice} onChangeText={setEditIndice} autoCapitalize="none" />
            <View style={{ gap: 10 }}>
              <Button label="Enregistrer" onPress={surSauvegarde} variant="primary" />
              <Button
                label="Annuler"
                onPress={() => {
                  setEnEdition(false);
                  setEditNom(cercle.nom);
                  setEditMot(cercle.mot_commun);
                  setEditIndice(cercle.mot_commun_indice ?? "");
                }}
                variant="secondary"
              />
            </View>
          </Card>
        ) : (
          // ---------------- Cercle existant, lecture ----------------
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>{cercle.nom}</Text>
              <View style={styles.motBox}>
                <Text style={styles.motLabel}>Mot commun (à dire de vive voix)</Text>
                <Text style={styles.motValue}>{cercle.mot_commun}</Text>
                {cercle.mot_commun_indice ? (
                  <Text style={styles.motIndice}>
                    Indice : {cercle.mot_commun_indice}
                  </Text>
                ) : null}
              </View>
              {suisCreateur ? (
                <Button
                  label="Modifier le cercle"
                  onPress={() => setEnEdition(true)}
                  variant="secondary"
                />
              ) : null}
            </Card>

            {codeTotp ? (
              <Card style={styles.card}>
                <Text style={typography.eyebrow}>Code de vérification rotatif</Text>
                <Text style={styles.hint}>
                  Un code partagé par tous les membres du cercle, change toutes
                  les 60 secondes. Utile pour prouver au téléphone que
                  vous êtes bien du même cercle.
                </Text>
                <View style={styles.totpBox}>
                  <Text style={styles.totpValue}>{formaterCode(codeTotp)}</Text>
                  <View style={styles.totpJaugeTrack}>
                    <View
                      style={[
                        styles.totpJaugeFill,
                        {
                          width: `${(secondesRestantes / 60) * 100}%`,
                          backgroundColor:
                            secondesRestantes < 10 ? "#f59e0b" : colors.cyan,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.totpCompteur}>
                    Nouveau code dans {secondesRestantes}s
                  </Text>
                </View>
              </Card>
            ) : null}

            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Vérifier le code d&apos;un proche</Text>
              <Text style={styles.hint}>
                Un membre de votre cercle vous a dit son code par téléphone ?
                Tapez-le ici pour confirmer qu&apos;il fait bien partie du cercle.
              </Text>
              <Field
                label="Code à 6 chiffres"
                value={codeAVerifier}
                onChangeText={(v) => {
                  setCodeAVerifier(v.replace(/\D/g, "").slice(0, 6));
                  setResultatVerification(null);
                }}
                placeholder="123456"
                keyboardType="number-pad"
              />
              {resultatVerification === "ok" ? (
                <AlertBox
                  variant="success"
                  message="✓ Code valide — la personne est bien membre de votre cercle."
                />
              ) : null}
              {resultatVerification === "ko" ? (
                <AlertBox
                  variant="error"
                  message="✗ Code invalide. Attention, cette personne ne fait probablement pas partie de votre cercle — ou le code a été mal transmis."
                />
              ) : null}
              <Button
                label="Vérifier ce code"
                onPress={verifierCode}
                variant="primary"
                disabled={codeAVerifier.length !== 6}
              />
            </Card>

            <Card style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={typography.eyebrow}>
                  Membres · {membres.length}
                </Text>
                {suisCreateur ? (
                  <Pressable onPress={() => setInvitAjout(true)} hitSlop={8}>
                    <Text style={styles.action}>+ Inviter</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={{ gap: 10 }}>
                {membres.map((m) => {
                  const estMoi = m.user_id === (cercle?.createur_id ?? null) && m.role === "createur";
                  const equipe = Boolean(m.user_id);
                  return (
                    <View key={m.id} style={styles.membreRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.membreNom}>
                          {m.nom ?? m.email}
                          {m.role === "createur" ? " · créateur" : ""}
                          {equipe ? " · ✓" : ""}
                        </Text>
                        <Text style={styles.membreMeta}>
                          {m.nom ? m.email : null}
                          {m.accepte_at ? " · accepté" : " · en attente"}
                          {equipe ? " · Proofeus équipé" : ""}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                        {equipe && !estMoi && m.user_id ? (
                          <Pressable
                            onPress={() => surPing(m.user_id!)}
                            disabled={enEnvoiPing}
                            hitSlop={6}
                          >
                            <Text style={styles.ping}>Pinger</Text>
                          </Pressable>
                        ) : null}
                        {suisCreateur && m.role !== "createur" ? (
                          <Pressable onPress={() => surRetrait(m)} hitSlop={8}>
                            <Text style={styles.supprimer}>Retirer</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Résultat d'un ping sortant (émetteur) */}
            {pingSortant ? (
              <Card
                style={{
                  ...styles.card,
                  ...(pingSortant.statut === "confirme" ? styles.cardOk : {}),
                  ...(pingSortant.statut === "refuse" ? styles.cardKo : {}),
                }}
              >
                <Text style={typography.eyebrow}>
                  Ping envoyé
                </Text>
                {pingSortant.statut === "en_attente" ? (
                  <Text style={styles.pingStatut}>
                    En attente de réponse… Le destinataire doit valider avec
                    Face ID sur son téléphone.
                  </Text>
                ) : null}
                {pingSortant.statut === "confirme" ? (
                  <Text style={[styles.pingStatut, { color: colors.emerald }]}>
                    ✓ Confirmé avec Face ID — c&apos;est bien votre proche.
                  </Text>
                ) : null}
                {pingSortant.statut === "refuse" ? (
                  <Text style={[styles.pingStatut, { color: "#dc2626" }]}>
                    ✗ Refusé par le destinataire — méfiance, ce n&apos;est
                    peut-être pas la personne que vous croyez.
                  </Text>
                ) : null}
                {pingSortant.statut === "expire" ? (
                  <Text style={styles.pingStatut}>
                    Ping expiré sans réponse. Peut-être que la personne
                    n&apos;a pas vu la notification.
                  </Text>
                ) : null}
                <Button
                  label="Fermer"
                  onPress={() => setPingSortant(null)}
                  variant="secondary"
                />
              </Card>
            ) : null}

            {invitAjout ? (
              <Card style={styles.card}>
                <Text style={typography.eyebrow}>Inviter un membre</Text>
                <Field
                  label="Email"
                  value={invitEmail}
                  onChangeText={setInvitEmail}
                  placeholder="proche@exemple.fr"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label="Nom (optionnel)"
                  value={invitNom}
                  onChangeText={setInvitNom}
                  placeholder="ex : Mamie Jeanne"
                  autoCapitalize="words"
                />
                <View style={{ gap: 10 }}>
                  <Button label="Envoyer l'invitation" onPress={surInvitation} variant="primary" />
                  <Button
                    label="Annuler"
                    onPress={() => {
                      setInvitAjout(false);
                      setInvitEmail("");
                      setInvitNom("");
                    }}
                    variant="secondary"
                  />
                </View>
              </Card>
            ) : null}

            <AlertBox
              variant="info"
              message="Trois défenses complémentaires : le PING avec Face ID (le plus fort, réseau requis), le CODE ROTATIF (marche sans réseau), le MOT COMMUN à dire de vive voix. L'imposteur ne peut passer aucune des trois."
            />
          </>
        )}
      </ScrollView>

      <PingRecuModal
        ping={pingEntrant}
        onRepondu={() => setPingEntrant(null)}
        onFerme={() => setPingEntrant(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { padding: 24, gap: 18, paddingBottom: 40 },
  header: { gap: 6 },
  back: { color: colors.fgTertiary, fontSize: 13 },
  title: { marginTop: 4 },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.fgTertiary,
    lineHeight: 20,
    marginTop: 4,
  },
  chargement: {
    ...typography.body,
    color: colors.fgTertiary,
    textAlign: "center",
    paddingVertical: 24,
  },
  card: { gap: 12 },
  hint: {
    ...typography.caption,
    color: colors.fgTertiary,
    lineHeight: 18,
  },
  motBox: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: "rgba(63,212,217,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(63,212,217,0.3)",
    alignItems: "center",
    gap: 6,
  },
  motLabel: {
    ...typography.caption,
    color: colors.fgTertiary,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  motValue: {
    ...typography.hero,
    color: colors.cyan,
    letterSpacing: 2,
    textTransform: "lowercase",
  },
  motIndice: {
    ...typography.caption,
    color: colors.fgSecondary,
    marginTop: 4,
    fontStyle: "italic",
  },
  totpBox: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: "rgba(63,212,217,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(63,212,217,0.3)",
    alignItems: "center",
    gap: 12,
  },
  totpValue: {
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 6,
    color: colors.cyan,
    fontVariant: ["tabular-nums"],
  },
  totpJaugeTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    overflow: "hidden",
  },
  totpJaugeFill: {
    height: "100%",
    borderRadius: 999,
  },
  totpCompteur: {
    ...typography.caption,
    color: colors.fgTertiary,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  ping: {
    ...typography.caption,
    color: colors.cyan,
    fontWeight: "700",
    fontSize: 12,
  },
  pingStatut: {
    ...typography.body,
    fontSize: 14,
    color: colors.fgSecondary,
    lineHeight: 20,
  },
  cardOk: {
    borderWidth: 1,
    borderColor: colors.emerald,
  },
  cardKo: {
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  action: {
    ...typography.caption,
    color: colors.cyan,
    fontWeight: "700",
  },
  membreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  membreNom: {
    ...typography.body,
    fontSize: 14,
    color: colors.fgPrimary,
    fontWeight: "600",
  },
  membreMeta: {
    ...typography.caption,
    color: colors.fgTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  supprimer: {
    ...typography.caption,
    color: "#dc2626",
    fontWeight: "600",
  },
});
