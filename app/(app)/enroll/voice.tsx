import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
} from "expo-audio";
import { AlertBox, Button, Card } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useAuth } from "@/auth/context";
import {
  REFERENCE_PHRASE,
  saveVoiceSample,
} from "@/biometrics/voice";

/**
 * Écran d'enrôlement de l'empreinte vocale.
 *
 * Étapes :
 *  1) Introduction + phrase de référence à lire
 *  2) Autorisation micro
 *  3) Capture 4-5 secondes de la lecture de la phrase
 *  4) Sauvegarde locale du fichier audio + hash SHA-256 comme empreinte
 *  5) Marker enrolment_status.voice = true côté Supabase
 *  6) Retour à la home avec le check ✓
 *
 * Le fichier audio ne quitte jamais l'appareil. Seul un hash est
 * (éventuellement) envoyé au serveur en V1 — remplacé par un vrai
 * voice embedding en V2 via TensorFlow Lite embarqué.
 */

type Step = "intro" | "recording" | "review" | "saving" | "done" | "error";

export default function VoiceEnrolmentScreen() {
  const router = useRouter();
  const { profil, updateProfil } = useAuth();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [step, setStep] = useState<Step>("intro");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Animation halo pour la capture
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (step !== "recording") {
      pulse.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [step, pulse]);

  // Compteur pendant l'enregistrement (auto-stop à 8s pour laisser
  // le temps de lire la phrase à un rythme naturel)
  useEffect(() => {
    if (step !== "recording") {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      const dt = (Date.now() - started) / 1000;
      setElapsed(dt);
      if (dt >= 8) {
        clearInterval(timer);
        void stopRecording();
      }
    }, 100);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function startRecording() {
    try {
      setErrorMsg(null);
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg(
          "L'accès au microphone est nécessaire pour enrôler votre voix. Autorisez-le dans les réglages de votre iPhone.",
        );
        setStep("error");
        return;
      }
      await AudioModule.setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStep("recording");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur inconnue");
      setStep("error");
    }
  }

  async function stopRecording() {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("Aucun fichier enregistré");
      setRecordedUri(uri);
      setStep("review");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur d'arrêt");
      setStep("error");
    }
  }

  async function saveAndFinalize() {
    if (!recordedUri) return;
    setStep("saving");
    try {
      await saveVoiceSample(recordedUri, "reference");

      // Marker l'enrôlement voix comme complété
      const currentStatus = (profil?.enrolment_status ?? {}) as Record<
        string,
        unknown
      >;
      const { error } = await updateProfil({
        enrolment_status: {
          ...currentStatus,
          voice: {
            enrolled_at: new Date().toISOString(),
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

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Retour</Text>
          </Pressable>
          <Text style={typography.eyebrow}>Enrôlement · Voix</Text>
          <Text style={[typography.title, styles.title]}>
            Votre empreinte vocale.
          </Text>
        </View>

        {step === "intro" ? (
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Phrase à lire</Text>
              <Text style={styles.phrase}>« {REFERENCE_PHRASE} »</Text>
              <Text style={styles.hint}>
                Lisez-la à voix normale, comme si vous parliez à un ami.
                Restez dans un endroit calme, sans écouteurs. Vous aurez
                8 secondes pour la lire tranquillement.
              </Text>
            </Card>
            <AlertBox
              variant="info"
              message="Votre voix reste sur votre téléphone. Nous stockons uniquement une empreinte cryptographique irréversible — impossible de reconstituer votre voix à partir de nos données."
            />
            <View style={styles.actions}>
              <Button
                label="Enregistrer ma voix"
                onPress={startRecording}
                variant="primary"
              />
            </View>
          </>
        ) : null}

        {step === "recording" ? (
          <View style={styles.recordingBlock}>
            <View style={styles.recordingHalo}>
              <Animated.View
                style={[
                  styles.halo,
                  {
                    opacity: haloOpacity,
                    transform: [{ scale: haloScale }],
                  },
                ]}
              />
              <View style={styles.micDot} />
            </View>
            <Text style={styles.recordingTime}>
              {elapsed.toFixed(1)} s / 8.0 s
            </Text>
            <Text style={styles.recordingPhrase}>« {REFERENCE_PHRASE} »</Text>
            <Text style={styles.recordingHint}>
              Continuez à lire la phrase à voix normale…
            </Text>
            <Button
              label="Arrêter maintenant"
              onPress={stopRecording}
              variant="secondary"
            />
          </View>
        ) : null}

        {step === "review" ? (
          <>
            <AlertBox
              variant="info"
              message="Votre voix a été capturée. Validez pour enregistrer votre empreinte, ou recommencez si vous n'êtes pas satisfait."
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
                  setRecordedUri(null);
                  setStep("intro");
                }}
                variant="secondary"
              />
            </View>
          </>
        ) : null}

        {step === "saving" ? (
          <View style={styles.centered}>
            <Text style={styles.savingText}>
              Enregistrement de votre empreinte vocale…
            </Text>
          </View>
        ) : null}

        {step === "done" ? (
          <AlertBox
            variant="success"
            message="Empreinte vocale enregistrée. Retour à l'accueil…"
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
  phrase: {
    fontStyle: "italic",
    fontSize: 20,
    lineHeight: 28,
    color: colors.fgPrimary,
    fontWeight: "500",
  },
  hint: {
    ...typography.body,
    fontSize: 13,
    color: colors.fgTertiary,
    lineHeight: 20,
  },

  actions: { gap: 12 },

  recordingBlock: { alignItems: "center", gap: 20, paddingVertical: 20 },
  recordingHalo: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 9999,
    backgroundColor: colors.cyan,
  },
  micDot: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: colors.fgPrimary,
  },
  recordingTime: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.cyan,
    fontVariant: ["tabular-nums"],
  },
  recordingPhrase: {
    fontStyle: "italic",
    fontSize: 17,
    lineHeight: 24,
    color: colors.fgPrimary,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  recordingHint: {
    ...typography.caption,
    color: colors.fgTertiary,
    textAlign: "center",
  },

  centered: { alignItems: "center", paddingVertical: 32 },
  savingText: { ...typography.body, color: colors.fgSecondary },
});
