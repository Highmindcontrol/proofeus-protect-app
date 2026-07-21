import { useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { AlertBox, Button, Card } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useAuth } from "@/auth/context";
import {
  mesurerAccelerometre,
  saveLivenessSample,
  tirerDefiAleatoire,
  type Defi,
  type MesureAccelerometre,
} from "@/biometrics/liveness";

/**
 * Écran de détection du vivant — 3 étapes.
 *
 *   1. Intro + choix du défi aléatoire
 *   2. Enregistrement vidéo du défi (caméra frontale)
 *   3. Mesure accéléromètre (téléphone tenu 3 s dans la main)
 *   4. Validation + retour home
 *
 * V0 pragmatique — capture vidéo + hash + mesure variance
 * accéléromètre. V1 : analyse ML des mouvements + PPG frame-par-frame
 * pour le pouls cardiaque.
 */

type Etape =
  | { kind: "intro" }
  | { kind: "defi" }
  | { kind: "review_defi"; uri: string }
  | { kind: "accelerometre_intro" }
  | { kind: "accelerometre_mesure" }
  | { kind: "accelerometre_resultat"; mesure: MesureAccelerometre }
  | { kind: "saving" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function LivenessEnrolmentScreen() {
  const router = useRouter();
  const { profil, updateProfil } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const enregistrementRef = useRef<boolean>(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [etape, setEtape] = useState<Etape>({ kind: "intro" });
  const [enregistrement, setEnregistrement] = useState(false);
  const [videoHash, setVideoHash] = useState<string | null>(null);
  const [mesureAccel, setMesureAccel] = useState<MesureAccelerometre | null>(null);

  const defi = useMemo<Defi>(() => tirerDefiAleatoire(), []);

  async function demarrer() {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setEtape({
          kind: "error",
          message: "L'accès à la caméra est nécessaire pour la détection du vivant.",
        });
        return;
      }
    }
    setEtape({ kind: "defi" });
  }

  async function enregistrerDefi() {
    if (!cameraRef.current || enregistrementRef.current) return;
    enregistrementRef.current = true;
    setEnregistrement(true);
    try {
      // recordAsync bloque jusqu'à stopRecording
      const stopTimeout = setTimeout(() => {
        cameraRef.current?.stopRecording();
      }, defi.duree_ms + 1000);

      const video = await cameraRef.current.recordAsync({ maxDuration: 10 });
      clearTimeout(stopTimeout);

      if (!video?.uri) throw new Error("Enregistrement vidéo échoué");
      setEtape({ kind: "review_defi", uri: video.uri });
    } catch (e) {
      setEtape({
        kind: "error",
        message: e instanceof Error ? e.message : "Erreur d'enregistrement",
      });
    } finally {
      enregistrementRef.current = false;
      setEnregistrement(false);
    }
  }

  async function validerDefi(uri: string) {
    try {
      const { hash } = await saveLivenessSample(uri, "defi");
      setVideoHash(hash);
      setEtape({ kind: "accelerometre_intro" });
    } catch (e) {
      setEtape({
        kind: "error",
        message: e instanceof Error ? e.message : "Erreur de sauvegarde",
      });
    }
  }

  async function lancerMesureAccel() {
    setEtape({ kind: "accelerometre_mesure" });
    try {
      const mesure = await mesurerAccelerometre(3000);
      setMesureAccel(mesure);
      setEtape({ kind: "accelerometre_resultat", mesure });
    } catch (e) {
      setEtape({
        kind: "error",
        message: e instanceof Error ? e.message : "Erreur mesure accéléromètre",
      });
    }
  }

  async function finaliser() {
    if (!videoHash || !mesureAccel) return;
    setEtape({ kind: "saving" });
    try {
      // Sauver aussi la mesure accéléromètre
      const jsonMesure = JSON.stringify(mesureAccel);
      const { hash: hashAccel } = await saveLivenessSample(jsonMesure, "accelerometre");

      const currentStatus = (profil?.enrolment_status ?? {}) as Record<string, unknown>;
      const { error } = await updateProfil({
        enrolment_status: {
          ...currentStatus,
          liveness: {
            enrolled_at: new Date().toISOString(),
            method: "defi+accelerometre-v0",
            defi_cle: defi.cle,
            video_hash: videoHash,
            accelerometre_hash: hashAccel,
            accelerometre_verdict: mesureAccel.verdict,
          },
        },
      });
      if (error) throw new Error(error);
      setEtape({ kind: "done" });
      setTimeout(() => router.replace("/home"), 1200);
    } catch (e) {
      setEtape({
        kind: "error",
        message: e instanceof Error ? e.message : "Erreur de sauvegarde",
      });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Retour</Text>
          </Pressable>
          <Text style={typography.eyebrow}>Enrôlement · Détection du vivant</Text>
          <Text style={[typography.title, styles.title]}>
            Prouver que vous êtes bien vivant.
          </Text>
        </View>

        {etape.kind === "intro" ? (
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Comment ça marche</Text>
              <Text style={styles.hint}>
                La détection du vivant garantit que vous êtes réellement présent
                au moment de l&apos;enrôlement — pas une photo, pas une vidéo,
                pas un deepfake, pas un mannequin.
              </Text>
              <Text style={styles.hint}>
                Deux tests en 20 secondes :
              </Text>
              <Text style={styles.hint}>
                <Text style={styles.hintFort}>1. Défi vidéo aléatoire</Text> — une
                consigne tirée au sort, impossible à préparer à l&apos;avance.
              </Text>
              <Text style={styles.hint}>
                <Text style={styles.hintFort}>2. Test accéléromètre</Text> — vous
                tenez le téléphone 3 secondes, nous mesurons les micro-tremblements
                naturels d&apos;une main humaine.
              </Text>
            </Card>
            <Button label="Commencer" onPress={demarrer} variant="primary" />
          </>
        ) : null}

        {etape.kind === "defi" ? (
          <>
            <Card style={styles.defiCard}>
              <Text style={styles.defiTirage}>Défi tiré au sort</Text>
              <Text style={styles.defiInstruction}>{defi.instruction}</Text>
              <Text style={styles.defiHint}>Durée : {defi.duree_ms / 1000} s</Text>
            </Card>
            <View style={styles.cameraWrap}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
                mode="video"
              />
              <View style={styles.oval} pointerEvents="none" />
              {enregistrement ? (
                <View style={styles.recBadge}>
                  <View style={styles.recDot} />
                  <Text style={styles.recText}>REC</Text>
                </View>
              ) : null}
            </View>
            <Button
              label={enregistrement ? "Enregistrement en cours…" : "Démarrer le défi"}
              onPress={enregistrerDefi}
              variant="primary"
              disabled={enregistrement}
            />
          </>
        ) : null}

        {etape.kind === "review_defi" ? (
          <>
            <AlertBox
              variant="info"
              message="Défi enregistré. Validez pour passer au test accéléromètre, ou recommencez."
            />
            <View style={{ gap: 10 }}>
              <Button
                label="Valider et continuer"
                onPress={() => validerDefi(etape.uri)}
                variant="primary"
              />
              <Button
                label="Recommencer le défi"
                onPress={() => setEtape({ kind: "defi" })}
                variant="secondary"
              />
            </View>
          </>
        ) : null}

        {etape.kind === "accelerometre_intro" ? (
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Test accéléromètre</Text>
              <Text style={styles.hint}>
                Tenez naturellement votre téléphone dans la main, sans le poser,
                pendant 3 secondes. Nous mesurons les micro-tremblements
                naturels d&apos;une main humaine — impossibles à reproduire avec
                un téléphone posé sur un support.
              </Text>
            </Card>
            <Button
              label="Lancer la mesure (3 s)"
              onPress={lancerMesureAccel}
              variant="primary"
            />
          </>
        ) : null}

        {etape.kind === "accelerometre_mesure" ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.cyan} />
            <Text style={styles.mesureTexte}>
              Mesure en cours — tenez le téléphone naturellement…
            </Text>
          </View>
        ) : null}

        {etape.kind === "accelerometre_resultat" ? (
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Résultat</Text>
              <View style={styles.resultatLigne}>
                <Text style={styles.resultatLabel}>Verdict</Text>
                <Text
                  style={[
                    styles.resultatValue,
                    { color: verdictCouleur(etape.mesure.verdict) },
                  ]}
                >
                  {verdictLibelle(etape.mesure.verdict)}
                </Text>
              </View>
              <View style={styles.resultatLigne}>
                <Text style={styles.resultatLabel}>Échantillons</Text>
                <Text style={styles.resultatValue}>{etape.mesure.echantillons}</Text>
              </View>
              <View style={styles.resultatLigne}>
                <Text style={styles.resultatLabel}>Variance (magnitude)</Text>
                <Text style={styles.resultatValue}>
                  {etape.mesure.variance_magnitude.toExponential(2)}
                </Text>
              </View>
            </Card>
            {etape.mesure.verdict !== "humain_probable" ? (
              <AlertBox
                variant="info"
                message={
                  etape.mesure.verdict === "immobile_suspect"
                    ? "Le téléphone semble posé ou immobile. Tenez-le naturellement dans la main et recommencez pour un enrôlement plus fiable."
                    : "Les mouvements détectés sont trop violents. Restez plus calme et recommencez."
                }
              />
            ) : null}
            <View style={{ gap: 10 }}>
              <Button
                label="Enregistrer l'enrôlement"
                onPress={finaliser}
                variant="primary"
              />
              <Button
                label="Recommencer la mesure"
                onPress={lancerMesureAccel}
                variant="secondary"
              />
            </View>
          </>
        ) : null}

        {etape.kind === "saving" ? (
          <View style={styles.centered}>
            <Text style={styles.mesureTexte}>Enregistrement en cours…</Text>
          </View>
        ) : null}

        {etape.kind === "done" ? (
          <AlertBox
            variant="success"
            message="Détection du vivant enregistrée. Retour à l'accueil…"
          />
        ) : null}

        {etape.kind === "error" ? (
          <>
            <AlertBox variant="error" message={etape.message} />
            <Button
              label="Recommencer depuis le début"
              onPress={() => {
                setVideoHash(null);
                setMesureAccel(null);
                setEtape({ kind: "intro" });
              }}
              variant="primary"
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function verdictLibelle(v: MesureAccelerometre["verdict"]): string {
  switch (v) {
    case "humain_probable":
      return "Main humaine détectée";
    case "immobile_suspect":
      return "Téléphone immobile";
    case "trop_agite":
      return "Trop agité";
  }
}

function verdictCouleur(v: MesureAccelerometre["verdict"]): string {
  switch (v) {
    case "humain_probable":
      return colors.emerald;
    case "immobile_suspect":
    case "trop_agite":
      return "#f59e0b";
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { padding: 24, gap: 18, paddingBottom: 40 },
  header: { gap: 8 },
  back: { color: colors.fgTertiary, fontSize: 13 },
  title: { marginTop: 4 },

  card: { gap: 12 },
  hint: {
    ...typography.body,
    fontSize: 13,
    color: colors.fgTertiary,
    lineHeight: 20,
  },
  hintFort: {
    color: colors.fgPrimary,
    fontWeight: "700",
  },

  defiCard: {
    gap: 8,
    borderWidth: 2,
    borderColor: colors.cyan,
    backgroundColor: "rgba(63,212,217,0.05)",
    alignItems: "center",
    paddingVertical: 20,
  },
  defiTirage: {
    ...typography.caption,
    color: colors.cyan,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  defiInstruction: {
    ...typography.title,
    fontSize: 22,
    color: colors.fgPrimary,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  defiHint: {
    ...typography.caption,
    color: colors.fgTertiary,
    marginTop: 4,
  },

  cameraWrap: {
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.bgSecondary,
    position: "relative",
  },
  camera: { flex: 1 },
  oval: {
    position: "absolute",
    top: "10%",
    left: "15%",
    right: "15%",
    bottom: "20%",
    borderWidth: 2,
    borderColor: colors.cyan,
    borderRadius: 9999,
    opacity: 0.6,
  },
  recBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(220,38,38,0.85)",
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  recText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  resultatLigne: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: 4,
  },
  resultatLabel: {
    ...typography.caption,
    color: colors.fgTertiary,
  },
  resultatValue: {
    ...typography.body,
    fontSize: 14,
    color: colors.fgPrimary,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },

  centered: { alignItems: "center", paddingVertical: 32, gap: 16 },
  mesureTexte: {
    ...typography.body,
    color: colors.fgSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
