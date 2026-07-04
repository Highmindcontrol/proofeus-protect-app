import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Shield } from "@/components/Shield";
import { Button } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useRouter } from "expo-router";

/**
 * Écran de bienvenue — première impression pour un utilisateur qui
 * ouvre l'app sans compte. Deux CTA : créer un compte, se connecter.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.top}>
          <Text style={typography.eyebrow}>Proofeus®</Text>
          <Text style={styles.tagline}>Souveraineté biométrique individuelle</Text>
        </View>

        <View style={styles.center}>
          <Shield size={200} />
          <Text style={[typography.hero, styles.heroText]}>
            Prouvez votre humanité
            <Text style={{ color: colors.cyan }}> réelle</Text>.
          </Text>
          <Text style={[typography.body, styles.subtitle]}>
            Cinq signaux convergents en trois secondes. Vos données biométriques
            ne quittent jamais votre téléphone.
          </Text>
        </View>

        <View style={styles.bottom}>
          <Button
            label="Créer mon compte"
            onPress={() => router.push("/signup")}
            variant="primary"
          />
          <Button
            label="J'ai déjà un compte"
            onPress={() => router.push("/login")}
            variant="secondary"
          />
          <Link href="/biometric-test" style={styles.testLink}>
            <Text style={styles.testLinkText}>Tester la biométrie de l&apos;appareil</Text>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "space-between",
    gap: 32,
    minHeight: "100%",
  },
  top: { alignItems: "center", gap: 6 },
  tagline: {
    ...typography.caption,
    color: colors.fgTertiary,
  },
  center: {
    alignItems: "center",
    gap: 28,
    paddingVertical: 24,
  },
  heroText: {
    textAlign: "center",
    paddingHorizontal: 12,
  },
  subtitle: {
    textAlign: "center",
    paddingHorizontal: 20,
    maxWidth: 340,
  },
  bottom: { gap: 12 },
  testLink: {
    alignSelf: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  testLinkText: {
    ...typography.caption,
    color: colors.fgTertiary,
    textDecorationLine: "underline",
  },
});
