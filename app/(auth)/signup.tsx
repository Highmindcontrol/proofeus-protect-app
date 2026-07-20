import { useEffect } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

/**
 * Ancien écran d'inscription — désactivé le 19 juillet 2026.
 *
 * Depuis cette date, la création de compte Proofeus se fait uniquement
 * sur le web via paiement Stripe. Cet écran est conservé comme
 * placeholder pour rediriger tout accès direct (deep link vers /signup,
 * navigation historique) vers proofeus.com/rejoindre.
 */

const URL_REJOINDRE = "https://proofeus.com/rejoindre";

export default function SignUpDeprecatedScreen() {
  const router = useRouter();

  useEffect(() => {
    // Tentative d'ouverture automatique du navigateur puis retour welcome
    Linking.openURL(URL_REJOINDRE).catch(() => {
      // silencieux — l'utilisateur peut cliquer sur le bouton manuellement
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Text style={typography.eyebrow}>Créer un compte</Text>
        <Text style={[typography.hero, styles.title]}>
          Rendez-vous sur proofeus.com
        </Text>
        <Text style={[typography.body, styles.body]}>
          La création de compte Proofeus se fait sur le web — vous choisissez
          votre forfait, vous payez, puis vous revenez dans l&apos;application
          pour vous connecter et faire votre enrôlement biométrique.
        </Text>

        <View style={styles.buttons}>
          <Button
            label="Ouvrir proofeus.com/rejoindre"
            onPress={() => Linking.openURL(URL_REJOINDRE)}
            variant="primary"
          />
          <Button
            label="Retour à l'accueil"
            onPress={() => router.replace("/welcome")}
            variant="secondary"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 20,
  },
  title: {
    textAlign: "left",
  },
  body: {
    marginTop: 8,
    marginBottom: 16,
  },
  buttons: {
    gap: 12,
  },
});
