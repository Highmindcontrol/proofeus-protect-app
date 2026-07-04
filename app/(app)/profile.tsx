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
import { useAuth, type ProtectProfil } from "@/auth/context";

const PROFILS: Array<{
  value: NonNullable<ProtectProfil["profil_type"]>;
  label: string;
  hint: string;
}> = [
  { value: "particulier", label: "Particulier", hint: "Je me protège moi-même" },
  { value: "senior", label: "Senior", hint: "Je protège ma famille" },
  { value: "cadre", label: "Cadre / profession libérale", hint: "Je protège mes échanges pro" },
  { value: "entreprise", label: "Entreprise", hint: "Je protège une équipe" },
];

/**
 * Écran de profil — recueille prénom, nom et type de profil pour
 * personnaliser l'expérience et la communication.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { profil, updateProfil } = useAuth();

  const [prenom, setPrenom] = useState(profil?.prenom ?? "");
  const [nom, setNom] = useState(profil?.nom ?? "");
  const [profilType, setProfilType] = useState<NonNullable<ProtectProfil["profil_type"]> | null>(
    profil?.profil_type ?? null,
  );
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "error"; message: string }
    | { type: "success" }
  >({ type: "idle" });

  async function handleSave() {
    if (!prenom.trim() || !nom.trim()) {
      setStatus({ type: "error", message: "Prénom et nom requis." });
      return;
    }
    if (!profilType) {
      setStatus({ type: "error", message: "Choisissez un profil." });
      return;
    }
    setStatus({ type: "loading" });
    const { error } = await updateProfil({
      prenom: prenom.trim(),
      nom: nom.trim(),
      profil_type: profilType,
    });
    if (error) {
      setStatus({ type: "error", message: error });
      return;
    }
    setStatus({ type: "success" });
    setTimeout(() => router.replace("/home"), 800);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Link href="/home" style={styles.back}>
            <Text style={styles.backText}>← Retour</Text>
          </Link>
          <Text style={typography.eyebrow}>Votre profil</Text>
          <Text style={[typography.title, styles.title]}>
            Faisons connaissance.
          </Text>
          <Text style={[typography.body, styles.subtitle]}>
            Ces informations personnalisent l&apos;expérience et nos
            communications. Vous pouvez les modifier à tout moment.
          </Text>
        </View>

        {status.type === "error" ? (
          <AlertBox variant="error" message={status.message} />
        ) : null}
        {status.type === "success" ? (
          <AlertBox variant="success" message="Profil enregistré." />
        ) : null}

        <View style={styles.form}>
          <Field
            label="Prénom"
            value={prenom}
            onChangeText={setPrenom}
            autoCapitalize="words"
            autoComplete="given-name"
          />
          <Field
            label="Nom"
            value={nom}
            onChangeText={setNom}
            autoCapitalize="words"
            autoComplete="family-name"
          />

          <View style={styles.profilSection}>
            <Text style={styles.profilLabel}>Type de profil</Text>
            <View style={styles.profilList}>
              {PROFILS.map((p) => {
                const active = profilType === p.value;
                return (
                  <Pressable
                    key={p.value}
                    onPress={() => setProfilType(p.value)}
                    style={[
                      styles.profilChoice,
                      active && styles.profilChoiceActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.profilChoiceLabel,
                        active && styles.profilChoiceLabelActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                    <Text style={styles.profilChoiceHint}>{p.hint}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label="Enregistrer"
            onPress={handleSave}
            variant="primary"
            loading={status.type === "loading"}
          />
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
  backText: { color: colors.fgTertiary, fontSize: 13 },
  title: { marginTop: 4 },
  subtitle: { marginTop: 4 },
  form: { gap: 16 },
  profilSection: { gap: 12 },
  profilLabel: {
    ...typography.caption,
    color: colors.fgSecondary,
    fontWeight: "600",
  },
  profilList: { gap: 8 },
  profilChoice: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  profilChoiceActive: {
    borderColor: colors.cyan,
    backgroundColor: colors.cyanSoft,
  },
  profilChoiceLabel: {
    color: colors.fgPrimary,
    fontWeight: "600",
    fontSize: 15,
  },
  profilChoiceLabelActive: { color: colors.cyan },
  profilChoiceHint: {
    ...typography.caption,
    color: colors.fgTertiary,
  },
  actions: { gap: 12 },
});
