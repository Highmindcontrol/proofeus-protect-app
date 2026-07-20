import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
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
import { definirCodesSecurite, lireCodesSecurite, type CodesSecurite } from "@/urgence/service";

/**
 * Écran de configuration des mots de sécurité.
 *
 * L'utilisateur définit deux mots secrets :
 *   - Un mot rassurant : ce qu'il donne quand tout va bien (option
 *     pédagogique pour habituer un proche à demander le mot)
 *   - Un mot de contrainte : ce qu'il donne sous menace — sa saisie
 *     dans l'app déclenche une alerte discrète aux contacts d'urgence
 *
 * Les mots sont hashés côté device (SHA-256, mot en minuscule). Le
 * serveur ne stocke que les hashes, jamais les mots en clair. La
 * vérification se fait aussi côté device en comparant le hash saisi
 * à ceux stockés.
 */

export default function CodesSecuriteScreen() {
  const router = useRouter();
  const [existant, setExistant] = useState<CodesSecurite | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [motRassurant, setMotRassurant] = useState("");
  const [motRassurantIndice, setMotRassurantIndice] = useState("");
  const [motContrainte, setMotContrainte] = useState("");
  const [motContrainteIndice, setMotContrainteIndice] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const c = await lireCodesSecurite();
      setExistant(c);
      if (c?.mot_rassurant_indice) setMotRassurantIndice(c.mot_rassurant_indice);
      if (c?.mot_contrainte_indice) setMotContrainteIndice(c.mot_contrainte_indice);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function surEnregistrement() {
    setErreur(null);
    setSucces(null);

    if (!motRassurant.trim() || !motContrainte.trim()) {
      setErreur("Les deux mots sont obligatoires.");
      return;
    }
    if (motRassurant.trim().length < 3 || motContrainte.trim().length < 3) {
      setErreur("Chaque mot doit contenir au moins 3 caractères.");
      return;
    }

    setEnregistrement(true);
    try {
      await definirCodesSecurite({
        motRassurant,
        motRassurantIndice,
        motContrainte,
        motContrainteIndice,
      });
      setSucces("Vos mots de sécurité sont enregistrés.");
      setMotRassurant("");
      setMotContrainte("");
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Retour</Text>
          </Pressable>
          <Text style={typography.eyebrow}>Sécurité+ · Mots de sécurité</Text>
          <Text style={[typography.title, styles.title]}>
            Deux mots, deux signaux.
          </Text>
          <Text style={styles.subtitle}>
            Sous menace, dire votre mot de contrainte déclenche une alerte
            discrète auprès de vos contacts, sans que votre attaquant s&apos;en
            aperçoive.
          </Text>
        </View>

        {erreur ? <AlertBox variant="error" message={erreur} /> : null}
        {succes ? <AlertBox variant="success" message={succes} /> : null}

        {existant?.a_mot_rassurant && existant?.a_mot_contrainte ? (
          <AlertBox
            variant="info"
            message="Vos mots sont déjà configurés. Vous pouvez les redéfinir ci-dessous — les mots précédents seront remplacés."
          />
        ) : null}

        {/* Bloc mot rassurant */}
        <Card style={styles.card}>
          <Text style={typography.eyebrow}>Mot rassurant</Text>
          <Text style={styles.hint}>
            Le mot que vous donnez quand tout va bien. Utile pour habituer un
            proche à toujours demander ce mot avant de vous croire.
          </Text>
          <Field
            label="Mot rassurant"
            value={motRassurant}
            onChangeText={setMotRassurant}
            placeholder={
              existant?.a_mot_rassurant ? "•••••••• (déjà défini)" : "ex : jasmin"
            }
            autoCapitalize="none"
            secureTextEntry
          />
          <Field
            label="Indice public (optionnel)"
            value={motRassurantIndice}
            onChangeText={setMotRassurantIndice}
            placeholder="ex : ma fleur préférée"
            autoCapitalize="none"
          />
        </Card>

        {/* Bloc mot de contrainte */}
        <Card style={styles.cardDanger}>
          <Text style={typography.eyebrow}>Mot de contrainte</Text>
          <Text style={styles.hint}>
            Le mot que vous donnez sous menace. Sa saisie dans l&apos;app
            déclenche une alerte silencieuse aux contacts. Choisissez un mot
            que vous n&apos;utilisez jamais spontanément.
          </Text>
          <Field
            label="Mot de contrainte"
            value={motContrainte}
            onChangeText={setMotContrainte}
            placeholder={
              existant?.a_mot_contrainte ? "•••••••• (déjà défini)" : "ex : orage"
            }
            autoCapitalize="none"
            secureTextEntry
          />
          <Field
            label="Indice public (optionnel)"
            value={motContrainteIndice}
            onChangeText={setMotContrainteIndice}
            placeholder="ex : phénomène météo violent"
            autoCapitalize="none"
          />
        </Card>

        <Button
          label={enregistrement ? "Enregistrement…" : "Enregistrer mes mots"}
          onPress={surEnregistrement}
          variant="primary"
          disabled={enregistrement || chargement}
        />

        <AlertBox
          variant="info"
          message="Vos mots ne sont jamais stockés en clair. Seul un hash cryptographique irréversible est enregistré. La vérification se fait localement sur votre appareil."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { padding: 24, gap: 18, paddingBottom: 40 },
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
  card: { gap: 12 },
  cardDanger: {
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(220, 38, 38, 0.3)",
    backgroundColor: "rgba(220, 38, 38, 0.03)",
  },
  hint: {
    ...typography.caption,
    color: colors.fgTertiary,
    lineHeight: 18,
  },
});
