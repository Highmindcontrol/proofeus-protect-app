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
                <Text style={styles.motLabel}>Mot commun</Text>
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
                {membres.map((m) => (
                  <View key={m.id} style={styles.membreRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.membreNom}>
                        {m.nom ?? m.email}
                        {m.role === "createur" ? " · créateur" : ""}
                      </Text>
                      <Text style={styles.membreMeta}>
                        {m.nom ? m.email : null}
                        {m.accepte_at ? " · accepté" : " · en attente"}
                      </Text>
                    </View>
                    {suisCreateur && m.role !== "createur" ? (
                      <Pressable onPress={() => surRetrait(m)} hitSlop={8}>
                        <Text style={styles.supprimer}>Retirer</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </Card>

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
              message="Le mot commun s'utilise verbalement — au téléphone, en visio, en personne. Demandez « quel est le mot de notre cercle ? » à quiconque prétend être un proche. Le vrai le connaît, l'imposteur non."
            />
          </>
        )}
      </ScrollView>
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
