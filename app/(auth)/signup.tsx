import { useState } from "react";
import { Link, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertBox, Button, Field } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useAuth } from "@/auth/context";

/**
 * Écran d'inscription — email + mot de passe + consentement RGPD.
 * Après inscription réussie, l'utilisateur reçoit un email de
 * confirmation Supabase, puis peut se connecter.
 */
export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rgpd, setRgpd] = useState(false);
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "success" }
    | { type: "error"; message: string }
  >({ type: "idle" });

  async function handleSubmit() {
    if (!email.includes("@")) {
      setStatus({ type: "error", message: "Email invalide." });
      return;
    }
    if (password.length < 10) {
      setStatus({
        type: "error",
        message: "Le mot de passe doit faire au moins 10 caractères.",
      });
      return;
    }
    if (password !== confirm) {
      setStatus({
        type: "error",
        message: "Les deux mots de passe ne correspondent pas.",
      });
      return;
    }
    if (!rgpd) {
      setStatus({
        type: "error",
        message:
          "Vous devez accepter la politique de confidentialité pour créer un compte.",
      });
      return;
    }

    setStatus({ type: "loading" });
    const { error } = await signUp({ email, password, rgpdConsent: true });
    if (error) {
      setStatus({ type: "error", message: error });
      return;
    }
    setStatus({ type: "success" });
  }

  if (status.type === "success") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={typography.eyebrow}>Compte créé</Text>
            <Text style={[typography.title, styles.title]}>
              Vérifiez votre email.
            </Text>
          </View>
          <AlertBox
            variant="success"
            message={`Un email de confirmation a été envoyé à ${email}. Cliquez sur le lien pour activer votre compte, puis revenez ici pour vous connecter.`}
          />
          <Button
            label="Retour à la connexion"
            onPress={() => router.replace("/login")}
            variant="primary"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Link href="/welcome" style={styles.back}>
            <Text style={styles.backText}>← Retour</Text>
          </Link>
          <Text style={typography.eyebrow}>Créer un compte</Text>
          <Text style={[typography.title, styles.title]}>
            Votre Sceau, en quelques secondes.
          </Text>
          <Text style={[typography.body, styles.subtitle]}>
            Un email, un mot de passe. C&apos;est tout ce dont nous avons
            besoin pour démarrer.
          </Text>
        </View>

        {status.type === "error" ? (
          <AlertBox variant="error" message={status.message} />
        ) : null}

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="vous@exemple.com"
          />
          <Field
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            hint="10 caractères minimum"
          />
          <Field
            label="Confirmer le mot de passe"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />

          <Pressable
            onPress={() => setRgpd(!rgpd)}
            style={styles.rgpdRow}
          >
            <View style={[styles.checkbox, rgpd && styles.checkboxChecked]}>
              {rgpd ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text style={styles.rgpdText}>
              J&apos;accepte la politique de confidentialité et je consens
              au traitement de mes données personnelles conformément au RGPD.
            </Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Button
            label="Créer mon compte"
            onPress={handleSubmit}
            variant="primary"
            loading={status.type === "loading"}
          />
          <Link href="/login" style={styles.linkAlt}>
            <Text style={styles.linkAltText}>
              Vous avez déjà un compte ? Se connecter →
            </Text>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: {
    padding: 24,
    gap: 24,
    paddingBottom: 40,
  },
  header: { gap: 8 },
  back: { alignSelf: "flex-start", marginBottom: 8 },
  backText: {
    color: colors.fgTertiary,
    fontSize: 13,
  },
  title: { marginTop: 4 },
  subtitle: { marginTop: 4 },
  form: { gap: 16 },
  rgpdRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan,
  },
  check: {
    color: colors.bgPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  rgpdText: {
    flex: 1,
    ...typography.body,
    color: colors.fgSecondary,
    lineHeight: 20,
    fontSize: 13,
  },
  actions: { gap: 12 },
  linkAlt: { alignSelf: "center", paddingVertical: 8 },
  linkAltText: {
    ...typography.caption,
    color: colors.fgTertiary,
  },
});
