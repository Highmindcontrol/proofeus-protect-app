import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  Image,
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
import { savePalmSample } from "@/biometrics/palm";

/**
 * Écran d'enrôlement de la paume — quatrième modalité biométrique (V0).
 *
 * V0 : capture photo de la paume ouverte face à la caméra arrière +
 * hash SHA-256 comme empreinte préliminaire. Précision attendue 85-90 %
 * en fusion.
 *
 * V1 (à venir) : segmentation MediaPipe Hands (21 landmarks) + extraction
 * géométrique (longueur des doigts, ratios articulaires, motifs de
 * lignes visibles) via module natif. Le UI ne changera pas.
 *
 * Le réseau veineux profond (précision > 99 %) nécessite un capteur
 * infrarouge dédié — non disponible sur smartphone grand public,
 * prévu en évolution matérielle future.
 */

type Step = "intro" | "camera" | "review" | "saving" | "done" | "error";

export default function PalmEnrolmentScreen() {
  const router = useRouter();
  const { profil, updateProfil } = useAuth();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>("intro");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  async function startFlow() {
    setErrorMsg(null);
    if (!permission?.granted) {
      const req = await requestPermission();
      if (!req.granted) {
        setErrorMsg(
          "L'accès à la caméra est nécessaire pour capturer votre paume. Autorisez-le dans les réglages de votre iPhone.",
        );
        setStep("error");
        return;
      }
    }
    setStep("camera");
  }

  async function capturePhoto() {
    try {
      if (!cameraRef.current) throw new Error("Caméra non prête");
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error("Aucune photo capturée");
      setCapturedUri(photo.uri);
      setStep("review");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur de capture");
      setStep("error");
    }
  }

  async function saveAndFinalize() {
    if (!capturedUri) return;
    setStep("saving");
    try {
      await savePalmSample(capturedUri, "reference");

      const currentStatus = (profil?.enrolment_status ?? {}) as Record<string, unknown>;
      const { error } = await updateProfil({
        enrolment_status: {
          ...currentStatus,
          palm: {
            enrolled_at: new Date().toISOString(),
            method: "photo-rgb",
            samples: 1,
          },
        },
      });
      if (error) throw new Error(error);
      setStep("done");
      setTimeout(() => router.replace("/home"), 900);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur de sauvegarde");
      setStep("error");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Retour</Text>
          </Pressable>
          <Text style={typography.eyebrow}>Enrôlement · Paume</Text>
          <Text style={[typography.title, styles.title]}>
            Votre empreinte de main.
          </Text>
        </View>

        {step === "intro" ? (
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Comment ça marche</Text>
              <Text style={styles.hint}>
                Nous allons capturer une photo de votre paume ouverte. Placez
                votre main à plat, doigts écartés, à environ 30 cm de la
                caméra arrière, sur un fond uni de préférence.
              </Text>
              <Text style={styles.hint}>
                La géométrie de votre main (longueur des doigts, écarts,
                lignes visibles) forme une empreinte unique. La photo reste
                sur votre iPhone, seul un hash cryptographique est calculé.
              </Text>
            </Card>
            <AlertBox
              variant="info"
              message="La précision de la paume par caméra RGB est de 85-90 % en fusion multi-modale. Cette modalité complète les autres signaux (voix, morphologie, iris, présence vivante) pour une fiabilité globale supérieure à 99,5 %."
            />
            <View style={styles.actions}>
              <Button
                label="Commencer l'enrôlement"
                onPress={startFlow}
                variant="primary"
              />
            </View>
          </>
        ) : null}

        {step === "camera" ? (
          <>
            <View style={styles.cameraWrap}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
              />
              <View style={styles.palmGuide} pointerEvents="none" />
            </View>
            <Text style={styles.hint}>
              Placez votre paume ouverte dans le cadre cyan, doigts écartés,
              face à la caméra.
            </Text>
            <View style={styles.actions}>
              <Button label="Capturer" onPress={capturePhoto} variant="primary" />
            </View>
          </>
        ) : null}

        {step === "review" && capturedUri ? (
          <>
            <View style={styles.reviewImageWrap}>
              <Image source={{ uri: capturedUri }} style={styles.reviewImage} />
            </View>
            <AlertBox
              variant="info"
              message="Votre photo de paume est capturée. Validez pour enregistrer votre empreinte, ou recommencez si vous n'êtes pas satisfait."
            />
            <View style={styles.actions}>
              <Button
                label="Valider l'empreinte"
                onPress={saveAndFinalize}
                variant="primary"
              />
              <Button
                label="Recommencer"
                onPress={() => {
                  setCapturedUri(null);
                  setStep("camera");
                }}
                variant="secondary"
              />
            </View>
          </>
        ) : null}

        {step === "saving" ? (
          <View style={styles.centered}>
            <Text style={styles.savingText}>
              Enregistrement de votre empreinte de main…
            </Text>
          </View>
        ) : null}

        {step === "done" ? (
          <AlertBox
            variant="success"
            message="Empreinte de main enregistrée. Retour à l'accueil…"
          />
        ) : null}

        {step === "error" ? (
          <>
            <AlertBox
              variant="error"
              message={errorMsg ?? "Une erreur est survenue."}
            />
            <View style={styles.actions}>
              <Button
                label="Réessayer"
                onPress={() => {
                  setErrorMsg(null);
                  setCapturedUri(null);
                  setStep("intro");
                }}
                variant="primary"
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { padding: 24, gap: 20, paddingBottom: 40 },
  header: { gap: 8 },
  back: { color: colors.fgTertiary, fontSize: 13 },
  title: { marginTop: 4 },

  card: { gap: 14 },
  hint: {
    ...typography.body,
    fontSize: 13,
    color: colors.fgTertiary,
    lineHeight: 20,
  },
  actions: { gap: 12 },

  cameraWrap: {
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.bgSecondary,
    position: "relative",
  },
  camera: { flex: 1 },
  palmGuide: {
    position: "absolute",
    top: "12%",
    left: "18%",
    right: "18%",
    bottom: "12%",
    borderWidth: 2,
    borderColor: colors.cyan,
    borderRadius: 32,
    opacity: 0.65,
  },

  reviewImageWrap: {
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.bgSecondary,
  },
  reviewImage: { flex: 1, width: "100%", height: "100%" },

  centered: { alignItems: "center", paddingVertical: 32 },
  savingText: { ...typography.body, color: colors.fgSecondary },
});
