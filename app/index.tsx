import { Link } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Shield } from "@/components/Shield";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

/**
 * Écran d'accueil de l'app Proofeus Protect.
 * Bouclier animé + baseline + CTA vers l'écran de test biométrique.
 */
export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.top}>
          <Text style={typography.eyebrow}>Proofeus®</Text>
          <Text style={styles.tagline}>Souveraineté biométrique individuelle</Text>
        </View>

        <View style={styles.center}>
          <Shield size={220} />
          <Text style={[typography.hero, styles.heroText]}>
            Prouvez votre humanité
            <Text style={{ color: colors.cyan }}> réelle</Text>.
          </Text>
          <Text style={[typography.body, styles.subtitle]}>
            Cinq signaux convergents en trois secondes. Aucune donnée
            biométrique brute ne quitte votre téléphone.
          </Text>
        </View>

        <View style={styles.bottom}>
          <Link href="/biometric-test" asChild>
            <Pressable style={styles.cta}>
              <Text style={styles.ctaText}>Tester la biométrie de l&apos;appareil</Text>
              <Text style={styles.ctaArrow}>→</Text>
            </Pressable>
          </Link>
          <Text style={styles.footnote}>
            Version 0.1.0 · Développement en cours
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "space-between",
    minHeight: "100%",
  },
  top: {
    alignItems: "center",
    gap: 6,
  },
  tagline: {
    ...typography.caption,
    color: colors.fgTertiary,
  },
  center: {
    alignItems: "center",
    gap: 32,
    paddingVertical: 40,
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
  bottom: {
    gap: 16,
  },
  cta: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.cyan,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  ctaText: {
    color: colors.bgPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  ctaArrow: {
    color: colors.bgPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  footnote: {
    ...typography.caption,
    textAlign: "center",
    color: colors.fgMuted,
  },
});
