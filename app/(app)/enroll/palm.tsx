import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
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
import { AnalyseSimulee } from "@/components/AnalyseSimulee";
import { BarreProgressionEnrolement } from "@/components/BarreProgressionEnrolement";
import { CompteARebours } from "@/components/CompteARebours";

/**
 * Enrôlement paume — refonte UX 21 juillet 2026.
 *
 * Deux captures séquentielles (main gauche, main droite) avec compte
 * à rebours + analyse simulée + barre de progression.
 *
 * V2 : MediaPipe Hands 21 landmarks + géométrie articulaire pour un
 * vrai descripteur (précision 85-90 % en fusion).
 */

type Main = "gauche" | "droite";

const ETAPES: Array<{ main: Main; libelle: string; instruction: string }> = [
  {
    main: "gauche",
    libelle: "Main gauche",
    instruction: "Présentez la paume de votre main gauche face à la caméra, doigts écartés, fond uni derrière.",
  },
  {
    main: "droite",
    libelle: "Main droite",
    instruction: "Présentez la paume de votre main droite face à la caméra, doigts écartés, fond uni derrière.",
  },
];

type Etape =
  | { kind: "intro" }
  | { kind: "positionnement"; idx: number }
  | { kind: "rebours"; idx: number }
  | { kind: "capture"; idx: number }
  | { kind: "analyse"; idx: number }
  | { kind: "saving" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function PalmEnrolmentScreen() {
  const router = useRouter();
  const { profil, updateProfil } = useAuth();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [etape, setEtape] = useState<Etape>({ kind: "intro" });
  const [captures, setCaptures] = useState<Array<{ hash: string; main: Main }>>([]);

  async function demarrer() {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setEtape({
          kind: "error",
          message: "L'accès à la caméra est nécessaire pour capturer vos paumes.",
        });
        return;
      }
    }
    setEtape({ kind: "positionnement", idx: 0 });
  }

  async function capturerPaume(idx: number) {
    try {
      if (!cameraRef.current) throw new Error("Caméra non prête");
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error("Aucune photo capturée");
      const { hash } = await savePalmSample(photo.uri, "reference");
      setCaptures((prev) => [...prev, { hash, main: ETAPES[idx].main }]);
      setEtape({ kind: "analyse", idx });
    } catch (e) {
      setEtape({
        kind: "error",
        message: e instanceof Error ? e.message : "Erreur de capture",
      });
    }
  }

  function passerAEtapeSuivante(idx: number) {
    if (idx >= ETAPES.length - 1) {
      finaliser();
    } else {
      setEtape({ kind: "positionnement", idx: idx + 1 });
    }
  }

  async function finaliser() {
    setEtape({ kind: "saving" });
    try {
      const currentStatus = (profil?.enrolment_status ?? {}) as Record<string, unknown>;
      const { error } = await updateProfil({
        enrolment_status: {
          ...currentStatus,
          palm: {
            enrolled_at: new Date().toISOString(),
            method: "photo-rgb-2-mains",
            samples: captures.length,
            hashes: captures.reduce(
              (acc, c) => ({ ...acc, [c.main]: c.hash }),
              {} as Record<string, string>,
            ),
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

  const idxCourant =
    etape.kind === "positionnement" ||
    etape.kind === "rebours" ||
    etape.kind === "capture" ||
    etape.kind === "analyse"
      ? etape.idx
      : 0;
  const etapeCourante = ETAPES[idxCourant];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Retour</Text>
          </Pressable>
          <Text style={typography.eyebrow}>Enrôlement · Paume</Text>
          <Text style={[typography.title, styles.title]}>
            Vos deux paumes, séparément.
          </Text>
        </View>

        {etape.kind === "intro" ? (
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Comment ça marche</Text>
              <Text style={styles.hint}>
                Nous capturons vos deux paumes <Text style={styles.strong}>séparément</Text>,
                une main après l&apos;autre. La géométrie de la paume, les lignes
                de vie, la position des articulations forment une empreinte
                unique à chaque personne.
              </Text>
              <Text style={styles.hint}>
                Doigts bien écartés, fond uni de préférence, éclairage naturel.
                Deux captures rapprochées suffisent — le vrai matching
                multi-modal fera le reste.
              </Text>
            </Card>
            <Button label="Commencer l'enrôlement" onPress={demarrer} variant="primary" />
          </>
        ) : null}

        {etape.kind === "positionnement" ||
        etape.kind === "rebours" ||
        etape.kind === "capture" ? (
          <>
            <BarreProgressionEnrolement
              etapeActuelle={idxCourant + 1}
              etapes={ETAPES.map((e) => e.libelle)}
            />
            <Card style={styles.instructionCard}>
              <Text style={styles.instructionLibelle}>{etapeCourante.libelle}</Text>
              <Text style={styles.instructionTexte}>{etapeCourante.instruction}</Text>
            </Card>
            <View style={styles.cameraWrap}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
              />
              <View style={styles.palm} pointerEvents="none" />
              {etape.kind === "rebours" ? (
                <CompteARebours
                  duree={3}
                  onFini={() => setEtape({ kind: "capture", idx: etape.idx })}
                />
              ) : null}
              {etape.kind === "capture" ? (() => {
                capturerPaume(etape.idx);
                return null;
              })() : null}
            </View>
            {etape.kind === "positionnement" ? (
              <Button
                label="Je suis prêt — démarrer la capture"
                onPress={() => setEtape({ kind: "rebours", idx: idxCourant })}
                variant="primary"
              />
            ) : null}
          </>
        ) : null}

        {etape.kind === "analyse" ? (
          <>
            <BarreProgressionEnrolement
              etapeActuelle={idxCourant + 1}
              etapes={ETAPES.map((e) => e.libelle)}
            />
            <AnalyseSimulee
              type="palm"
              duree={2400}
              onFini={() => passerAEtapeSuivante(etape.idx)}
            />
          </>
        ) : null}

        {etape.kind === "saving" ? (
          <AnalyseSimulee type="palm" duree={1500} onFini={() => {}} />
        ) : null}

        {etape.kind === "done" ? (
          <AlertBox
            variant="success"
            message={`Deux paumes enregistrées — ${captures.length} captures. Retour à l'accueil…`}
          />
        ) : null}

        {etape.kind === "error" ? (
          <>
            <AlertBox variant="error" message={etape.message} />
            <Button
              label="Réessayer depuis le début"
              onPress={() => {
                setCaptures([]);
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { padding: 24, gap: 16, paddingBottom: 40 },
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
  strong: {
    color: colors.fgPrimary,
    fontWeight: "700",
  },

  instructionCard: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: colors.cyan,
    backgroundColor: "rgba(63,212,217,0.06)",
  },
  instructionLibelle: {
    ...typography.eyebrow,
    color: colors.cyan,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  instructionTexte: {
    ...typography.body,
    fontSize: 14,
    color: colors.fgPrimary,
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 20,
  },

  cameraWrap: {
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.bgSecondary,
    position: "relative",
  },
  camera: { flex: 1 },
  palm: {
    position: "absolute",
    top: "10%",
    left: "15%",
    right: "15%",
    bottom: "10%",
    borderWidth: 2,
    borderColor: colors.cyan,
    borderRadius: 32,
    opacity: 0.65,
  },
});
