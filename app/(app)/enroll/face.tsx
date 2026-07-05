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
import { authenticateDeviceBiometric } from "@/biometrics/device";
import { saveFaceSample } from "@/biometrics/face";

/**
 * Écran d'enrôlement de la morphologie faciale 3D.
 *
 * Approche A (MVP) :
 *  1) Intro + demande de consentement
 *  2) Validation Face ID native (le module TrueDepth capture ~30 000
 *     points 3D en infrarouge — c'est la vraie morphologie 3D côté hardware)
 *  3) Capture photo caméra frontale comme ancre visuelle
 *  4) Hash SHA-256 de la photo + save local
 *  5) Marker enrolment_status.face côté Supabase
 *  6) Retour à la home avec ✓
 *
 * Approche B (à venir) : module natif Swift qui expose ARKit ARFaceAnchor
 * pour extraire un vrai descripteur facial 3D (vecteur de features + hash).
 * Le UI ne changera pas — seul le moteur d'extraction sera remplacé.
 */

type Step =
  | "intro"
  | "faceid"
  | "camera"
  | "review"
  | "saving"
  | "done"
  | "error";

export default function FaceEnrolmentScreen() {
  const router = useRouter();
  const { profil, updateProfil } = useAuth();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>("intro");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  async function startFlow() {
    setErrorMsg(null);
    setStep("faceid");
    try {
      const result = await authenticateDeviceBiometric(
        "Proofeus — validez votre visage pour enrôler votre empreinte 3D",
      );
      if (!result.success) {
        setErrorMsg(
          result.error ??
            "La validation Face ID a échoué. Réessayez ou vérifiez que Face ID est activé sur cet iPhone.",
        );
        setStep("error");
        return;
      }
      // Face ID OK → étape caméra pour capturer l'ancre visuelle
      if (!permission?.granted) {
        const req = await requestPermission();
        if (!req.granted) {
          setErrorMsg(
            "L'accès à la caméra est nécessaire pour capturer votre visage. Autorisez-le dans les réglages de votre iPhone.",
          );
          setStep("error");
          return;
        }
      }
      setStep("camera");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur inconnue");
      setStep("error");
    }
  }

  async function capturePhoto() {
    try {
      if (!cameraRef.current) throw new Error("Caméra non prête");
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
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
      await saveFaceSample(capturedUri, "reference");

      const currentStatus = (profil?.enrolment_status ?? {}) as Record<
        string,
        unknown
      >;
      const { error } = await updateProfil({
        enrolment_status: {
          ...currentStatus,
          face: {
            enrolled_at: new Date().toISOString(),
            method: "faceid+photo",
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
          <Text style={typography.eyebrow}>Enrôlement · Morphologie 3D</Text>
          <Text style={[typography.title, styles.title]}>
            Votre empreinte faciale 3D.
          </Text>
        </View>

        {step === "intro" ? (
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Comment ça marche</Text>
              <Text style={styles.hint}>
                Face ID utilise le module TrueDepth de votre iPhone pour
                projeter environ 30 000 points infrarouges sur votre visage
                et en dériver une carte 3D précise au millimètre.
              </Text>
              <Text style={styles.hint}>
                Nous demandons cette validation, puis nous capturons une
                photo de référence avec la caméra frontale. Un hash
                cryptographique est calculé — la photo et la carte 3D
                restent sur votre iPhone.
              </Text>
            </Card>
            <AlertBox
              variant="info"
              message="Votre visage ne quitte jamais l'appareil. Face ID est traité dans le Secure Enclave d'Apple, et la photo de référence est chiffrée dans un espace privé accessible uniquement à Proofeus Protect."
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

        {step === "faceid" ? (
          <View style={styles.centered}>
            <Text style={styles.savingText}>Validation Face ID en cours…</Text>
          </View>
        ) : null}

        {step === "camera" ? (
          <>
            <View style={styles.cameraWrap}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
              />
              <View style={styles.oval} pointerEvents="none" />
            </View>
            <Text style={styles.hint}>
              Placez votre visage dans le cadre ovale, regardez droit vers
              l'objectif, éclairage naturel de préférence.
            </Text>
            <View style={styles.actions}>
              <Button
                label="Capturer"
                onPress={capturePhoto}
                variant="primary"
              />
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
              message="Votre photo de référence a été capturée. Validez pour enregistrer votre empreinte, ou recommencez si vous n'êtes pas satisfait."
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
              Enregistrement de votre empreinte faciale…
            </Text>
          </View>
        ) : null}

        {step === "done" ? (
          <AlertBox
            variant="success"
            message="Empreinte faciale enregistrée. Retour à l'accueil…"
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
  oval: {
    position: "absolute",
    top: "10%",
    left: "15%",
    right: "15%",
    bottom: "20%",
    borderWidth: 2,
    borderColor: colors.cyan,
    borderRadius: 9999,
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
