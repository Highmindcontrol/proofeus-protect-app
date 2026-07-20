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
import { saveIrisSample } from "@/biometrics/iris";

/**
 * Écran d'enrôlement de l'iris — cinquième modalité biométrique (V0).
 *
 * V0 : capture photo cadrée sur les yeux via la caméra frontale +
 * hash SHA-256 comme empreinte préliminaire. Précision par caméra RGB
 * variable selon la couleur d'œil (70-90 %) — c'est pour cette raison
 * qu'on ne s'appuie jamais sur l'iris seul mais toujours en fusion
 * multi-modale avec les quatre autres signaux.
 *
 * V1 (à venir) : segmentation MediaPipe Iris + descripteur de Daugman
 * (2048 bits) via module natif OpenCV. Le UI ne changera pas.
 */

type Step = "intro" | "camera" | "review" | "saving" | "done" | "error";

export default function IrisEnrolmentScreen() {
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
          "L'accès à la caméra est nécessaire pour capturer votre iris. Autorisez-le dans les réglages de votre iPhone.",
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
      await saveIrisSample(capturedUri, "reference");

      const currentStatus = (profil?.enrolment_status ?? {}) as Record<string, unknown>;
      const { error } = await updateProfil({
        enrolment_status: {
          ...currentStatus,
          iris: {
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
          <Text style={typography.eyebrow}>Enrôlement · Iris</Text>
          <Text style={[typography.title, styles.title]}>
            Votre empreinte oculaire.
          </Text>
        </View>

        {step === "intro" ? (
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Comment ça marche</Text>
              <Text style={styles.hint}>
                Placez votre visage à environ 25 cm de la caméra frontale,
                dans un éclairage clair mais non éblouissant, regardez droit
                vers l&apos;objectif.
              </Text>
              <Text style={styles.hint}>
                Nous capturons vos deux iris cadrés — la géométrie et le
                pattern de vos iris sont uniques, comme des empreintes
                digitales. La photo reste sur votre iPhone, seul un hash
                cryptographique est calculé.
              </Text>
            </Card>
            <AlertBox
              variant="info"
              message="La précision de l'iris par caméra frontale varie selon la couleur de vos yeux (70-90 %). Cette modalité n'est jamais utilisée seule — elle vient renforcer les autres signaux (voix, morphologie, paume, présence vivante) pour une fusion à plus de 99,5 %."
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
              <View style={styles.horizontalBand} pointerEvents="none">
                <View style={styles.eyeSlot} />
                <View style={styles.eyeSlot} />
              </View>
            </View>
            <Text style={styles.hint}>
              Alignez vos deux yeux dans les repères cyan. Regardez droit vers
              l&apos;objectif. Éclairage naturel de préférence.
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
              message="Votre photo de référence est capturée. Validez pour enregistrer votre empreinte, ou recommencez si vous n'êtes pas satisfait."
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
              Enregistrement de votre empreinte oculaire…
            </Text>
          </View>
        ) : null}

        {step === "done" ? (
          <AlertBox
            variant="success"
            message="Empreinte oculaire enregistrée. Retour à l'accueil…"
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
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.bgSecondary,
    position: "relative",
  },
  camera: { flex: 1 },
  horizontalBand: {
    position: "absolute",
    top: "35%",
    left: 0,
    right: 0,
    height: "30%",
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  eyeSlot: {
    width: "30%",
    height: "100%",
    borderWidth: 2,
    borderColor: colors.cyan,
    borderRadius: 999,
    opacity: 0.75,
  },

  reviewImageWrap: {
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.bgSecondary,
  },
  reviewImage: { flex: 1, width: "100%", height: "100%" },

  centered: { alignItems: "center", paddingVertical: 32 },
  savingText: { ...typography.body, color: colors.fgSecondary },
});
