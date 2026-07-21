import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { AlertBox, Button, Card } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { creerPreuve, statutPreuve, type Preuve } from "@/preuves/generateur";
import { couleurNiveau, LIBELLE_MODALITE } from "@/scoring/service";

/**
 * Écran « Générer une preuve d'humanité » — cœur produit de Proofeus.
 *
 * L'utilisateur appuie sur « Générer », un QR code apparaît, valable
 * 60 secondes. Il le montre à son interlocuteur qui scanne. La page
 * de vérification web marque la preuve comme consommée et affiche le
 * badge « humain vérifié ». L'app détecte la consommation via polling
 * léger (toutes les 2 s) et affiche un retour « vérifié ».
 */

const INTERVALLE_POLLING_MS = 2000;

export default function PreuveScreen() {
  const router = useRouter();
  const [preuve, setPreuve] = useState<Preuve | null>(null);
  const [enCoursGeneration, setEnCoursGeneration] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [secondesRestantes, setSecondesRestantes] = useState(0);
  const [statutFinal, setStatutFinal] = useState<
    "en_attente" | "verifie" | "expire" | null
  >(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const compteurRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const arreterTimers = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (compteurRef.current) {
      clearInterval(compteurRef.current);
      compteurRef.current = null;
    }
  }, []);

  useEffect(() => {
    return arreterTimers;
  }, [arreterTimers]);

  const genererNouvelle = useCallback(async () => {
    setEnCoursGeneration(true);
    setErreur(null);
    setStatutFinal("en_attente");
    arreterTimers();
    try {
      const nouvelle = await creerPreuve("presence");
      setPreuve(nouvelle);

      // Compteur secondes restantes
      const majSecondes = () => {
        const restant = Math.max(0, Math.round((nouvelle.expiresAt.getTime() - Date.now()) / 1000));
        setSecondesRestantes(restant);
        if (restant === 0) {
          setStatutFinal((prev) => (prev === "en_attente" ? "expire" : prev));
          arreterTimers();
        }
      };
      majSecondes();
      compteurRef.current = setInterval(majSecondes, 1000);

      // Polling statut consommée
      pollingRef.current = setInterval(async () => {
        const statut = await statutPreuve(nouvelle.code);
        if (statut?.consumedAt) {
          setStatutFinal("verifie");
          arreterTimers();
        }
      }, INTERVALLE_POLLING_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErreur(msg);
    } finally {
      setEnCoursGeneration(false);
    }
  }, [arreterTimers]);

  const pourcentageRestant = preuve
    ? Math.max(0, Math.min(100, (secondesRestantes / 60) * 100))
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Retour</Text>
          </Pressable>
          <Text style={typography.eyebrow}>Preuve d&apos;humanité</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.hero}>
          <Text style={[typography.title, styles.title]}>
            {statutFinal === "verifie"
              ? "Preuve validée."
              : statutFinal === "expire"
                ? "Preuve expirée."
                : preuve
                  ? "Montrez ce code à votre interlocuteur."
                  : "Prêt à prouver votre humanité."}
          </Text>
          <Text style={[typography.body, styles.subtitle]}>
            {statutFinal === "verifie"
              ? "Votre interlocuteur a scanné le QR et voit votre badge vérifié."
              : statutFinal === "expire"
                ? "Le délai de 60 secondes est passé. Générez une nouvelle preuve."
                : preuve
                  ? "Le QR est valable 60 secondes. Il ne peut être scanné qu'une seule fois."
                  : "Un QR code éphémère va être créé. Votre interlocuteur le scanne, et un badge « humain vérifié » s'affiche sur son écran."}
          </Text>
        </View>

        {erreur ? <AlertBox variant="error" message={erreur} /> : null}

        {preuve ? (
          <Card style={styles.qrCard}>
            <View style={styles.qrWrapper}>
              <View
                style={[
                  styles.qrFrame,
                  statutFinal === "verifie" && styles.qrFrameVerifie,
                  statutFinal === "expire" && styles.qrFrameExpire,
                ]}
              >
                <QRCode
                  value={preuve.urlVerification}
                  size={240}
                  color="#000000"
                  backgroundColor="#FFFFFF"
                  ecl="H"
                />
              </View>
              {statutFinal === "verifie" ? (
                <View style={styles.badgeVerifie}>
                  <Text style={styles.badgeText}>✓ VÉRIFIÉ</Text>
                </View>
              ) : null}
              {statutFinal === "expire" ? (
                <View style={styles.badgeExpire}>
                  <Text style={styles.badgeText}>EXPIRÉ</Text>
                </View>
              ) : null}
            </View>

            {statutFinal === "en_attente" ? (
              <View style={styles.compteurWrap}>
                <View style={styles.jaugeTrack}>
                  <View
                    style={[
                      styles.jaugeFill,
                      { width: `${pourcentageRestant}%` },
                    ]}
                  />
                </View>
                <Text style={styles.compteurTexte}>
                  {secondesRestantes} seconde{secondesRestantes > 1 ? "s" : ""}
                </Text>
              </View>
            ) : null}

            <View style={styles.scoreWrap}>
              <View style={styles.scoreHeader}>
                <Text style={styles.scoreLabel}>Niveau de confiance</Text>
                <Text
                  style={[
                    styles.scoreValue,
                    { color: couleurNiveau(preuve.score.niveau) },
                  ]}
                >
                  {preuve.score.score.toFixed(2)} %
                </Text>
              </View>
              <View style={styles.scoreBarreTrack}>
                <View
                  style={[
                    styles.scoreBarreFill,
                    {
                      width: `${Math.min(100, preuve.score.score)}%`,
                      backgroundColor: couleurNiveau(preuve.score.niveau),
                    },
                  ]}
                />
              </View>
              <Text style={styles.scoreLibelle}>{preuve.score.libelleNiveau}</Text>
              <Text style={styles.scoreDetail}>
                Fusion de {preuve.score.modalitesActives.length} modalité
                {preuve.score.modalitesActives.length > 1 ? "s" : ""} :{" "}
                {preuve.score.modalitesActives
                  .map((m) => LIBELLE_MODALITE[m])
                  .join(" · ")}
              </Text>
            </View>

            <View style={styles.metaWrap}>
              <Text style={styles.metaLabel}>URL scannée</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                proofeus.com/verify/{preuve.code.slice(0, 12)}…
              </Text>
            </View>

            {statutFinal === "en_attente" ? (
              <View style={styles.partageWrap}>
                <View style={styles.separateur}>
                  <View style={styles.separateurLigne} />
                  <Text style={styles.separateurTexte}>ou à distance</Text>
                  <View style={styles.separateurLigne} />
                </View>
                <Pressable
                  onPress={async () => {
                    try {
                      await Share.share({
                        message: `Je te prouve mon humanité via Proofeus. Ce lien est valable 60 secondes et à usage unique : ${preuve.urlVerification}`,
                        url: preuve.urlVerification,
                        title: "Preuve d'humanité Proofeus",
                      });
                    } catch {
                      // ignoré silencieusement — utilisateur a annulé
                    }
                  }}
                  style={({ pressed }) => [
                    styles.partageBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.partageBtnLabel}>
                    Envoyer par SMS / WhatsApp / mail
                  </Text>
                  <Text style={styles.partageBtnHint}>
                    Pour prouver votre humanité à quelqu&apos;un qui n&apos;est pas devant vous
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </Card>
        ) : null}

        <View style={styles.actions}>
          {!preuve || statutFinal === "verifie" || statutFinal === "expire" ? (
            <Button
              label={
                enCoursGeneration
                  ? "Génération…"
                  : preuve
                    ? "Générer une nouvelle preuve"
                    : "Générer une preuve"
              }
              onPress={genererNouvelle}
              variant="primary"
              disabled={enCoursGeneration}
            />
          ) : (
            <View style={styles.encoursIndic}>
              <ActivityIndicator color={colors.cyan} />
              <Text style={styles.encoursTexte}>En attente de scan…</Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.infoTexte}>
            <Text style={styles.infoStrong}>Comment l&apos;utiliser</Text>
            {"\n"}·{" "}
            <Text style={styles.infoStrong}>En personne / visio</Text> — montrez le QR à
            scanner{"\n"}·{" "}
            <Text style={styles.infoStrong}>À distance</Text> — envoyez le lien par SMS,
            WhatsApp, mail{"\n"}·{" "}
            <Text style={styles.infoStrong}>Au téléphone avec un proche</Text> — utilisez
            plutôt le mot de votre cercle
          </Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.infoTexte}>
            <Text style={styles.infoStrong}>Sécurité — </Text>
            Code aléatoire de 128 bits, valable une seule fois, expiré au bout de 60 secondes. Impossible à rejouer, impossible à falsifier.
          </Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  back: {
    ...typography.caption,
    color: colors.fgTertiary,
    width: 60,
  },
  hero: {
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
  },
  title: {
    textAlign: "center",
    paddingHorizontal: 12,
  },
  subtitle: {
    textAlign: "center",
    color: colors.fgSecondary,
    paddingHorizontal: 8,
    maxWidth: 360,
  },
  qrCard: {
    alignItems: "center",
    gap: 20,
    paddingVertical: 24,
  },
  qrWrapper: {
    position: "relative",
  },
  qrFrame: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.cyan,
  },
  qrFrameVerifie: {
    borderColor: colors.emerald,
  },
  qrFrameExpire: {
    borderColor: colors.fgMuted,
    opacity: 0.4,
  },
  badgeVerifie: {
    position: "absolute",
    top: -12,
    right: -12,
    backgroundColor: colors.emerald,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeExpire: {
    position: "absolute",
    top: -12,
    right: -12,
    backgroundColor: colors.fgSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  compteurWrap: {
    width: "100%",
    gap: 8,
  },
  jaugeTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    overflow: "hidden",
  },
  jaugeFill: {
    height: "100%",
    backgroundColor: colors.cyan,
    borderRadius: 999,
  },
  compteurTexte: {
    ...typography.caption,
    color: colors.fgSecondary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  scoreWrap: {
    width: "100%",
    padding: 14,
    backgroundColor: "rgba(63,212,217,0.05)",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(63,212,217,0.2)",
    gap: 8,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  scoreLabel: {
    ...typography.caption,
    color: colors.fgTertiary,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  scoreValue: {
    ...typography.body,
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  scoreBarreTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    overflow: "hidden",
  },
  scoreBarreFill: {
    height: "100%",
    borderRadius: 999,
  },
  scoreLibelle: {
    ...typography.body,
    fontSize: 13,
    fontWeight: "600",
    color: colors.fgPrimary,
  },
  scoreDetail: {
    ...typography.caption,
    color: colors.fgTertiary,
    fontSize: 11,
    lineHeight: 16,
  },
  metaWrap: {
    width: "100%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 16,
    gap: 4,
  },
  partageWrap: {
    width: "100%",
    gap: 12,
  },
  separateur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  separateurLigne: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  separateurTexte: {
    ...typography.caption,
    color: colors.fgTertiary,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  partageBtn: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(63,212,217,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(63,212,217,0.35)",
    alignItems: "center",
    gap: 4,
  },
  partageBtnLabel: {
    ...typography.body,
    fontSize: 14,
    color: colors.cyan,
    fontWeight: "700",
  },
  partageBtnHint: {
    ...typography.caption,
    color: colors.fgTertiary,
    fontSize: 11,
    textAlign: "center",
  },
  metaLabel: {
    ...typography.caption,
    color: colors.fgTertiary,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  metaValue: {
    ...typography.body,
    fontSize: 12,
    color: colors.fgSecondary,
    fontFamily: "monospace",
  },
  actions: { gap: 12 },
  encoursIndic: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  encoursTexte: {
    ...typography.body,
    color: colors.fgSecondary,
  },
  info: {
    padding: 16,
    backgroundColor: "rgba(63,212,217,0.05)",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(63,212,217,0.2)",
  },
  infoTexte: {
    ...typography.caption,
    color: colors.fgSecondary,
    lineHeight: 18,
  },
  infoStrong: {
    color: colors.fgPrimary,
    fontWeight: "700",
  },
});
