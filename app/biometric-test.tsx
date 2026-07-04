import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import {
  authenticateDeviceBiometric,
  checkDeviceBiometricSupport,
  type DeviceBiometricSupport,
} from "@/biometrics/device";

/**
 * Écran de test biométrique — première étape technique fonctionnelle.
 * Vérifie ce que l'appareil supporte, puis lance une authentification
 * Face ID / Touch ID / BiometricPrompt. Preuve de concept avant de
 * construire le vrai flow d'enrôlement multi-modal.
 */
export default function BiometricTestScreen() {
  const [support, setSupport] = useState<DeviceBiometricSupport | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    checkDeviceBiometricSupport()
      .then(setSupport)
      .catch((e) => setMessage(e?.message ?? "Erreur inconnue"));
  }, []);

  async function handleTest() {
    setStatus("loading");
    setMessage(null);
    try {
      const result = await authenticateDeviceBiometric(
        "Proofeus — test de vérification biométrique",
      );
      if (result.success) {
        setStatus("ok");
        setMessage("Authentification réussie — clé signée dans le Secure Enclave.");
      } else {
        setStatus("error");
        setMessage(result.error ?? "Échec de la vérification");
      }
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  const canTest = support?.hasHardware && support?.isEnrolled;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Link href="/" asChild>
            <Pressable>
              <Text style={styles.backLink}>← Retour</Text>
            </Pressable>
          </Link>
          <Text style={typography.eyebrow}>Test biométrique</Text>
          <Text style={[typography.title, styles.title]}>
            Ce que votre appareil est capable de faire.
          </Text>
        </View>

        {/* État des capacités */}
        <View style={styles.card}>
          <Text style={typography.eyebrow}>Capacités détectées</Text>
          {support === null ? (
            <Text style={styles.dim}>Détection en cours…</Text>
          ) : (
            <View style={styles.list}>
              <Row label="Hardware biométrique" value={support.hasHardware ? "Oui" : "Non"} />
              <Row label="Utilisateur enrôlé" value={support.isEnrolled ? "Oui" : "Non"} />
              <Row
                label="Modalités"
                value={
                  support.supportedTypes.length === 0
                    ? "Aucune"
                    : support.supportedTypes
                        .map((t) =>
                          t === "facial"
                            ? "Face ID / face"
                            : t === "fingerprint"
                              ? "Touch ID / empreinte"
                              : "Iris",
                        )
                        .join(" · ")
                }
              />
            </View>
          )}
        </View>

        {/* CTA */}
        <View style={styles.testSection}>
          <Pressable
            onPress={handleTest}
            disabled={!canTest || status === "loading"}
            style={[
              styles.cta,
              (!canTest || status === "loading") && styles.ctaDisabled,
            ]}
          >
            <Text style={styles.ctaText}>
              {status === "loading" ? "Vérification…" : "Lancer la vérification"}
            </Text>
          </Pressable>

          {!canTest && support !== null ? (
            <Text style={styles.warning}>
              Votre appareil ne dispose pas de biométrie enrôlée. Activez
              Face ID / Touch ID / empreinte dans les réglages de votre
              téléphone pour tester.
            </Text>
          ) : null}

          {message ? (
            <View
              style={[
                styles.messageBox,
                status === "ok" && styles.messageBoxOk,
                status === "error" && styles.messageBoxError,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  status === "ok" && { color: colors.emerald },
                  status === "error" && { color: colors.redAlertBright },
                ]}
              >
                {message}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Info technique */}
        <View style={styles.info}>
          <Text style={typography.eyebrow}>Détails techniques</Text>
          <Text style={styles.infoText}>
            L&apos;authentification biométrique de l&apos;appareil utilise le
            Secure Enclave (iPhone) ou le Titan M / Android Keystore
            (Android). Les données biométriques brutes ne quittent jamais
            le hardware sécurisé de votre téléphone.
          </Text>
          <Text style={styles.infoText}>
            Proofeus reçoit uniquement un booléen de réussite/échec et un
            jeton signé cryptographiquement, jamais votre empreinte, votre
            visage ou vos données brutes.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: {
    padding: 24,
    gap: 24,
    paddingBottom: 40,
  },
  header: { gap: 12 },
  backLink: {
    color: colors.fgTertiary,
    fontSize: 13,
    marginBottom: 8,
  },
  title: {
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
  },
  list: { gap: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    ...typography.body,
    color: colors.fgSecondary,
  },
  rowValue: {
    ...typography.bodyBold,
    color: colors.cyan,
  },
  dim: {
    ...typography.body,
    color: colors.fgMuted,
  },
  testSection: { gap: 12 },
  cta: {
    backgroundColor: colors.cyan,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaDisabled: {
    backgroundColor: colors.bgTertiary,
    opacity: 0.6,
  },
  ctaText: {
    color: colors.bgPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  warning: {
    ...typography.caption,
    color: colors.redAlertBright,
    textAlign: "center",
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  messageBox: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  messageBoxOk: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: colors.emerald,
  },
  messageBoxError: {
    backgroundColor: "rgba(166, 50, 50, 0.08)",
    borderColor: colors.redAlert,
  },
  messageText: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  info: {
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoText: {
    ...typography.body,
    color: colors.fgTertiary,
    lineHeight: 22,
  },
});
