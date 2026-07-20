import { useState } from "react";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Shield } from "@/components/Shield";
import { AlertBox, Button, Card } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useAuth } from "@/auth/context";

/**
 * Écran principal post-authentification — état de l'enrôlement,
 * navigation vers profil / réglages / test biométrique / déconnexion.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { user, profil, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace("/welcome");
  }

  const email = user?.email ?? "";
  const hasProfil = profil?.profil_type != null;
  const enrolment = (profil?.enrolment_status ?? {}) as Record<string, unknown>;
  const hasVoice = Boolean(enrolment.voice);
  const hasFace = Boolean(enrolment.face);
  const hasIris = Boolean(enrolment.iris);
  const hasPalm = Boolean(enrolment.palm);
  const enrolmentComplet = hasProfil && hasVoice && hasFace && hasIris && hasPalm;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={typography.eyebrow}>Proofeus®</Text>
            <Text style={styles.email}>{email}</Text>
          </View>
          <Pressable onPress={handleSignOut} disabled={signingOut} hitSlop={12}>
            <Text style={styles.signOut}>
              {signingOut ? "…" : "Déconnexion"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Shield size={140} />
          <Text style={[typography.title, styles.title]}>
            Votre Sceau est en construction.
          </Text>
        </View>

        {!hasProfil ? (
          <AlertBox
            variant="info"
            message="Complétez votre profil pour continuer la construction de votre Sceau."
          />
        ) : null}

        <Card style={styles.card}>
          <Text style={typography.eyebrow}>État de l&apos;enrôlement</Text>
          <View style={styles.list}>
            <Item label="Compte créé" status="ok" />
            <Item
              label="Profil complété"
              status={hasProfil ? "ok" : "pending"}
              onPress={() => router.push("/profile")}
            />
            <Item
              label="Empreinte vocale"
              status={hasVoice ? "ok" : hasProfil ? "pending" : "upcoming"}
              onPress={hasProfil ? () => router.push("/enroll/voice") : undefined}
            />
            <Item
              label="Morphologie 3D"
              status={hasFace ? "ok" : hasVoice ? "pending" : "upcoming"}
              onPress={hasVoice ? () => router.push("/enroll/face") : undefined}
            />
            <Item
              label="Iris"
              status={hasIris ? "ok" : hasFace ? "pending" : "upcoming"}
              onPress={hasFace ? () => router.push("/enroll/iris") : undefined}
            />
            <Item
              label="Paume"
              status={hasPalm ? "ok" : hasIris ? "pending" : "upcoming"}
              onPress={hasIris ? () => router.push("/enroll/palm") : undefined}
            />
            <Item label="Détection du vivant" status="upcoming" />
          </View>
        </Card>

        <View style={styles.actions}>
          {!hasProfil ? (
            <Button
              label="Compléter mon profil"
              onPress={() => router.push("/profile")}
              variant="primary"
            />
          ) : !hasVoice ? (
            <Button
              label="Enrôler mon empreinte vocale"
              onPress={() => router.push("/enroll/voice")}
              variant="primary"
            />
          ) : !hasFace ? (
            <Button
              label="Enrôler ma morphologie 3D"
              onPress={() => router.push("/enroll/face")}
              variant="primary"
            />
          ) : !hasIris ? (
            <Button
              label="Enrôler mon iris"
              onPress={() => router.push("/enroll/iris")}
              variant="primary"
            />
          ) : !hasPalm ? (
            <Button
              label="Enrôler ma paume"
              onPress={() => router.push("/enroll/palm")}
              variant="primary"
            />
          ) : (
            <Button
              label="Générer une preuve d'humanité"
              onPress={() => router.push("/preuve")}
              variant="primary"
            />
          )}
          {enrolmentComplet ? (
            <Button
              label="Revoir mon profil"
              onPress={() => router.push("/profile")}
              variant="secondary"
            />
          ) : null}
          <Button
            label="Tester la biométrie de l'appareil"
            onPress={() => router.push("/biometric-test")}
            variant="secondary"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Item({
  label,
  status,
  onPress,
}: {
  label: string;
  status: "ok" | "pending" | "upcoming";
  onPress?: () => void;
}) {
  const dot =
    status === "ok"
      ? { backgroundColor: colors.emerald }
      : status === "pending"
        ? { backgroundColor: colors.cyan }
        : { backgroundColor: colors.fgMuted };
  const labelStyle =
    status === "upcoming"
      ? { color: colors.fgMuted }
      : { color: colors.fgPrimary };
  const Content = (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <View style={[styles.dot, dot]} />
        <Text style={[styles.itemLabel, labelStyle]}>{label}</Text>
      </View>
      {status === "pending" && onPress ? (
        <Text style={styles.itemAction}>Compléter →</Text>
      ) : status === "ok" ? (
        <Text style={styles.itemDone}>✓</Text>
      ) : (
        <Text style={styles.itemUpcoming}>À venir</Text>
      )}
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress}>{Content}</Pressable>;
  }
  return Content;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: {
    padding: 24,
    gap: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { gap: 2 },
  email: {
    ...typography.caption,
    color: colors.fgTertiary,
  },
  signOut: {
    ...typography.caption,
    color: colors.fgTertiary,
    textDecorationLine: "underline",
  },
  hero: {
    alignItems: "center",
    gap: 20,
    paddingVertical: 20,
  },
  title: {
    textAlign: "center",
    paddingHorizontal: 20,
  },
  card: { gap: 16 },
  list: { gap: 12 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 9999 },
  itemLabel: { ...typography.body, fontSize: 14 },
  itemAction: {
    ...typography.caption,
    color: colors.cyan,
    fontWeight: "600",
  },
  itemDone: { color: colors.emerald, fontWeight: "700" },
  itemUpcoming: {
    ...typography.caption,
    color: colors.fgMuted,
  },
  actions: { gap: 12 },
});
