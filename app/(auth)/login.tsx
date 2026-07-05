import { useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertBox, Button, Field } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useAuth } from "@/auth/context";

/**
 * Écran de connexion — email + mot de passe.
 */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const { confirmed } = useLocalSearchParams<{ confirmed?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "error"; message: string }
  >({ type: "idle" });

  async function handleSubmit() {
    if (!email || !password) {
      setStatus({
        type: "error",
        message: "Email et mot de passe requis.",
      });
      return;
    }
    setStatus({ type: "loading" });
    const { error } = await signIn(email, password);
    if (error) {
      setStatus({ type: "error", message: error });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Link href="/welcome" style={styles.back}>
            <Text style={styles.backText}>← Retour</Text>
          </Link>
          <Text style={typography.eyebrow}>Se connecter</Text>
          <Text style={[typography.title, styles.title]}>Bon retour.</Text>
        </View>

        {confirmed === "1" && status.type !== "error" ? (
          <AlertBox
            variant="success"
            message="Votre email est confirmé. Connectez-vous pour continuer la construction de votre Sceau."
          />
        ) : null}

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
            autoComplete="current-password"
          />
        </View>

        <View style={styles.actions}>
          <Button
            label="Se connecter"
            onPress={handleSubmit}
            variant="primary"
            loading={status.type === "loading"}
          />
          <Link href="/signup" style={styles.linkAlt}>
            <Text style={styles.linkAltText}>
              Pas encore de compte ? Créer mon compte →
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
  form: { gap: 16 },
  actions: { gap: 12 },
  linkAlt: { alignSelf: "center", paddingVertical: 8 },
  linkAltText: {
    ...typography.caption,
    color: colors.fgTertiary,
  },
});
