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
  ajouterContact,
  listerContacts,
  supprimerContact,
  type ContactUrgence,
} from "@/urgence/service";

/**
 * Écran de gestion des contacts d'urgence.
 *
 * L'utilisateur ajoute ses proches (nom, email, téléphone, relation).
 * Chaque contact peut être notifié par email et/ou SMS lors du
 * déclenchement d'une alerte. L'ordre définit la priorité d'envoi.
 */

export default function ContactsUrgenceScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactUrgence[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Formulaire ajout
  const [ajout, setAjout] = useState(false);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [relation, setRelation] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      setContacts(await listerContacts());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function surAjout() {
    setErreur(null);
    if (!nom.trim()) {
      setErreur("Le nom est obligatoire.");
      return;
    }
    if (!email.trim() && !telephone.trim()) {
      setErreur("Renseignez au moins un email ou un téléphone.");
      return;
    }
    setEnregistrement(true);
    try {
      await ajouterContact({
        nom: nom.trim(),
        email: email.trim() || null,
        telephone: telephone.trim() || null,
        relation: relation.trim() || null,
        ordre: contacts.length + 1,
        notifie_par_email: Boolean(email.trim()),
        notifie_par_sms: Boolean(telephone.trim()),
        actif: true,
      });
      setNom("");
      setEmail("");
      setTelephone("");
      setRelation("");
      setAjout(false);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnregistrement(false);
    }
  }

  function surSuppression(contact: ContactUrgence) {
    if (!contact.id) return;
    Alert.alert(
      "Supprimer ce contact ?",
      `${contact.nom} ne sera plus notifié en cas d'alerte.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await supprimerContact(contact.id!);
              await charger();
            } catch (e) {
              setErreur(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Retour</Text>
          </Pressable>
          <Text style={typography.eyebrow}>Sécurité+ · Contacts</Text>
          <Text style={[typography.title, styles.title]}>
            Vos contacts d&apos;urgence.
          </Text>
          <Text style={styles.subtitle}>
            Les proches qui recevront votre position GPS et un message
            d&apos;alerte en cas de déclenchement.
          </Text>
        </View>

        {erreur ? <AlertBox variant="error" message={erreur} /> : null}

        {/* Liste des contacts */}
        {chargement ? (
          <Text style={styles.chargement}>Chargement…</Text>
        ) : contacts.length === 0 && !ajout ? (
          <Card style={styles.emptyCard}>
            <Text style={typography.body}>
              Aucun contact d&apos;urgence pour le moment.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {contacts.map((c) => (
              <Card key={c.id} style={styles.contactCard}>
                <View style={styles.contactHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactNom}>{c.nom}</Text>
                    {c.relation ? (
                      <Text style={styles.contactRelation}>{c.relation}</Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => surSuppression(c)} hitSlop={8}>
                    <Text style={styles.supprimer}>Supprimer</Text>
                  </Pressable>
                </View>
                {c.email ? (
                  <Text style={styles.contactDetail}>{c.email}</Text>
                ) : null}
                {c.telephone ? (
                  <Text style={styles.contactDetail}>{c.telephone}</Text>
                ) : null}
                <View style={styles.canauxRow}>
                  {c.notifie_par_email ? (
                    <Text style={styles.canal}>Email ✓</Text>
                  ) : null}
                  {c.notifie_par_sms ? (
                    <Text style={styles.canal}>SMS ✓</Text>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Formulaire d'ajout */}
        {ajout ? (
          <Card style={styles.formCard}>
            <Text style={typography.eyebrow}>Nouveau contact</Text>
            <Field
              label="Nom complet"
              value={nom}
              onChangeText={setNom}
              placeholder="Marie Dupont"
              autoCapitalize="words"
            />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="marie@exemple.fr"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Téléphone"
              value={telephone}
              onChangeText={setTelephone}
              placeholder="+33 6 12 34 56 78"
              keyboardType="phone-pad"
            />
            <Field
              label="Relation (optionnel)"
              value={relation}
              onChangeText={setRelation}
              placeholder="conjoint · parent · ami · médecin…"
              autoCapitalize="none"
            />
            <View style={styles.formActions}>
              <Button
                label={enregistrement ? "Enregistrement…" : "Enregistrer"}
                onPress={surAjout}
                variant="primary"
                disabled={enregistrement}
              />
              <Button
                label="Annuler"
                onPress={() => {
                  setAjout(false);
                  setErreur(null);
                }}
                variant="secondary"
              />
            </View>
          </Card>
        ) : (
          <Button
            label="+ Ajouter un contact d'urgence"
            onPress={() => setAjout(true)}
            variant="primary"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { padding: 24, gap: 20, paddingBottom: 40 },
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
  emptyCard: {
    alignItems: "center",
    paddingVertical: 24,
  },
  contactCard: { gap: 8 },
  contactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  contactNom: {
    ...typography.body,
    fontSize: 16,
    fontWeight: "700",
    color: colors.fgPrimary,
  },
  contactRelation: {
    ...typography.caption,
    color: colors.fgTertiary,
    marginTop: 2,
  },
  contactDetail: {
    ...typography.caption,
    color: colors.fgSecondary,
  },
  supprimer: {
    ...typography.caption,
    color: "#dc2626",
    fontWeight: "600",
  },
  canauxRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  canal: {
    ...typography.caption,
    color: colors.emerald,
    fontSize: 11,
    fontWeight: "600",
  },
  formCard: { gap: 14 },
  formActions: { gap: 10, marginTop: 4 },
});
