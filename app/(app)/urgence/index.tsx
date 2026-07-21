import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertBox, Card } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import {
  declencherAlerte,
  listerContacts,
  listerMesCercles,
  type Cercle,
  type ContactUrgence,
} from "@/urgence/service";

/**
 * Écran Sécurité+ / Urgence — vue d'ensemble et bouton d'alerte.
 *
 * Contient :
 *   - Statut du cercle de confiance (mot commun) — clic → /urgence/cercle
 *   - Statut des contacts d'urgence (à alerter en cas de SOS) —
 *     clic → /urgence/contacts
 *   - Bouton SOS rouge : géoloc + notification email aux contacts
 */

export default function UrgenceScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactUrgence[]>([]);
  const [cercles, setCercles] = useState<Cercle[]>([]);
  const [chargement, setChargement] = useState(true);
  const [declenchement, setDeclenchement] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const [c, k] = await Promise.all([listerContacts(), listerMesCercles()]);
      setContacts(c);
      setCercles(k);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setChargement(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  useEffect(() => {
    void charger();
  }, [charger]);

  async function surAlerte() {
    if (contacts.length === 0) {
      setErreur(
        "Aucun contact d'urgence configuré. Ajoutez au moins un contact avant de pouvoir déclencher une alerte.",
      );
      return;
    }
    Alert.alert(
      "Déclencher l'alerte ?",
      `Vos ${contacts.length} contact${contacts.length > 1 ? "s" : ""} d'urgence recevront votre position GPS actuelle.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déclencher",
          style: "destructive",
          onPress: async () => {
            setErreur(null);
            setSucces(null);
            setDeclenchement(true);
            try {
              const r = await declencherAlerte({ type: "bouton_manuel" });
              setSucces(
                `Alerte envoyée à ${r.contactsNotifies} contact${r.contactsNotifies > 1 ? "s" : ""}.`,
              );
            } catch (e) {
              setErreur(e instanceof Error ? e.message : String(e));
            } finally {
              setDeclenchement(false);
            }
          },
        },
      ],
    );
  }

  const cercle = cercles[0];
  const nbContacts = contacts.length;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Retour</Text>
          </Pressable>
          <Text style={typography.eyebrow}>Sécurité+</Text>
          <Text style={[typography.title, styles.title]}>
            Votre protection active.
          </Text>
          <Text style={styles.subtitle}>
            Le mot de votre cercle contre les usurpations, vos contacts
            d&apos;urgence pour l&apos;alerte, votre position instantanée si
            besoin.
          </Text>
        </View>

        {erreur ? <AlertBox variant="error" message={erreur} /> : null}
        {succes ? <AlertBox variant="success" message={succes} /> : null}

        {/* Cercle de confiance */}
        <Pressable onPress={() => router.push("/urgence/cercle")}>
          <Card style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={typography.eyebrow}>Mon cercle de confiance</Text>
                <Text style={styles.cardValue}>
                  {chargement
                    ? "…"
                    : cercle
                      ? cercle.nom
                      : "Aucun cercle créé"}
                </Text>
                {cercle ? (
                  <Text style={styles.motBadge}>Mot : {cercle.mot_commun}</Text>
                ) : null}
              </View>
              <Text style={styles.chev}>›</Text>
            </View>
            <Text style={styles.cardHint}>
              {cercle
                ? "Demandez « quel est le mot de notre cercle ? » à quiconque prétend être un proche. Le vrai le sait, l'imposteur non."
                : "Créez un cercle avec un mot commun partagé par vos proches — la meilleure défense contre les arnaques téléphoniques et deepfakes vocaux."}
            </Text>
          </Card>
        </Pressable>

        {/* Contacts d'urgence */}
        <Pressable onPress={() => router.push("/urgence/contacts")}>
          <Card style={styles.card}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={typography.eyebrow}>Contacts d&apos;urgence</Text>
                <Text style={styles.cardValue}>
                  {chargement
                    ? "…"
                    : `${nbContacts} contact${nbContacts > 1 ? "s" : ""} configuré${nbContacts > 1 ? "s" : ""}`}
                </Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </View>
            <Text style={styles.cardHint}>
              {nbContacts === 0
                ? "Ajoutez vos proches — ils recevront votre position en cas d'alerte."
                : contacts
                    .slice(0, 3)
                    .map((c) => c.nom)
                    .join(" · ")}
            </Text>
          </Card>
        </Pressable>

        {/* Bouton alerte */}
        <View style={styles.alertZone}>
          <Text style={styles.alertTitle}>Déclencher l&apos;alerte</Text>
          <Text style={styles.alertSubtitle}>
            En cas de danger immédiat, envoie votre position GPS actuelle à
            tous vos contacts d&apos;urgence.
          </Text>
          <Pressable
            onPress={surAlerte}
            disabled={declenchement || nbContacts === 0}
            style={({ pressed }) => [
              styles.alertBtn,
              pressed && styles.alertBtnPressed,
              (declenchement || nbContacts === 0) && styles.alertBtnDisabled,
            ]}
          >
            <Text style={styles.alertBtnLabel}>
              {declenchement ? "Envoi en cours…" : "SOS — Déclencher"}
            </Text>
          </Pressable>
          {nbContacts === 0 ? (
            <Text style={styles.warnText}>
              Ajoutez au moins un contact avant d&apos;activer l&apos;alerte.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { padding: 24, gap: 20, paddingBottom: 40 },
  header: { gap: 8 },
  back: { color: colors.fgTertiary, fontSize: 13 },
  title: { marginTop: 4 },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.fgTertiary,
    marginTop: 6,
    lineHeight: 20,
  },
  card: { gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardValue: {
    ...typography.body,
    fontSize: 15,
    color: colors.fgPrimary,
    fontWeight: "600",
    marginTop: 4,
  },
  motBadge: {
    ...typography.caption,
    color: colors.cyan,
    marginTop: 2,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  cardHint: {
    ...typography.caption,
    color: colors.fgTertiary,
    lineHeight: 18,
  },
  chev: {
    fontSize: 24,
    color: colors.fgTertiary,
  },

  alertZone: {
    marginTop: 12,
    padding: 20,
    backgroundColor: "rgba(220, 38, 38, 0.06)",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(220, 38, 38, 0.3)",
    alignItems: "center",
    gap: 16,
  },
  alertTitle: {
    ...typography.title,
    fontSize: 20,
    color: "#dc2626",
  },
  alertSubtitle: {
    ...typography.caption,
    color: colors.fgSecondary,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  alertBtn: {
    width: "100%",
    paddingVertical: 20,
    backgroundColor: "#dc2626",
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  alertBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  alertBtnDisabled: {
    backgroundColor: colors.fgMuted,
    shadowOpacity: 0,
  },
  alertBtnLabel: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1,
  },
  warnText: {
    ...typography.caption,
    color: "#dc2626",
    textAlign: "center",
  },
});
