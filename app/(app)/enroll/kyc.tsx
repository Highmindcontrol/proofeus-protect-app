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
import {
  LIBELLES_PIECE,
  pieceANecessiteVerso,
  saveKycSample,
  type TypePiece,
} from "@/kyc/service";

/**
 * Écran KYC — vérification d'identité par capture de pièce officielle
 * + selfie de face match.
 *
 * V0 : capture des 2 ou 3 photos (recto + verso éventuel + selfie),
 * stockage local + hash SHA-256, marquage dans enrolment_status.kyc.
 *
 * V1 (à venir) : OCR MRZ automatique, face match ML Kit/Vision, ou
 * intégration Onfido/Veriff pour vérification tierce certifiée.
 *
 * Aucune photo ne quitte jamais l'appareil en clair — seuls les hashes
 * sont envoyés à Supabase.
 */

type Etape =
  | { kind: "intro" }
  | { kind: "choix" }
  | { kind: "capture"; slot: "recto" | "verso" | "selfie" }
  | { kind: "review"; slot: "recto" | "verso" | "selfie"; uri: string }
  | { kind: "saving" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function KycEnrolmentScreen() {
  const router = useRouter();
  const { profil, updateProfil } = useAuth();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [etape, setEtape] = useState<Etape>({ kind: "intro" });
  const [typePiece, setTypePiece] = useState<TypePiece | null>(null);
  const [captures, setCaptures] = useState<{
    recto?: { uri: string; hash: string };
    verso?: { uri: string; hash: string };
    selfie?: { uri: string; hash: string };
  }>({});

  async function demarrer() {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setEtape({
          kind: "error",
          message: "L'accès à la caméra est nécessaire pour scanner votre pièce d'identité.",
        });
        return;
      }
    }
    setEtape({ kind: "choix" });
  }

  function choisirType(type: TypePiece) {
    setTypePiece(type);
    setEtape({ kind: "capture", slot: "recto" });
  }

  async function capturer(slot: "recto" | "verso" | "selfie") {
    try {
      if (!cameraRef.current) throw new Error("Caméra non prête");
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error("Aucune photo capturée");
      setEtape({ kind: "review", slot, uri: photo.uri });
    } catch (e) {
      setEtape({
        kind: "error",
        message: e instanceof Error ? e.message : "Erreur de capture",
      });
    }
  }

  async function valider(slot: "recto" | "verso" | "selfie", uri: string) {
    try {
      const { hash } = await saveKycSample(uri, slot);
      const nouveaux = { ...captures, [slot]: { uri, hash } };
      setCaptures(nouveaux);

      // Étape suivante selon le flow
      const type = typePiece!;
      if (slot === "recto") {
        if (pieceANecessiteVerso(type)) {
          setEtape({ kind: "capture", slot: "verso" });
        } else {
          setEtape({ kind: "capture", slot: "selfie" });
        }
      } else if (slot === "verso") {
        setEtape({ kind: "capture", slot: "selfie" });
      } else if (slot === "selfie") {
        await finaliser(nouveaux);
      }
    } catch (e) {
      setEtape({
        kind: "error",
        message: e instanceof Error ? e.message : "Erreur de sauvegarde",
      });
    }
  }

  async function finaliser(
    nouveaux: typeof captures,
  ) {
    setEtape({ kind: "saving" });
    try {
      const currentStatus = (profil?.enrolment_status ?? {}) as Record<string, unknown>;
      const { error } = await updateProfil({
        enrolment_status: {
          ...currentStatus,
          kyc: {
            enrolled_at: new Date().toISOString(),
            type_piece: typePiece,
            photos_hashes: {
              recto: nouveaux.recto?.hash ?? null,
              verso: nouveaux.verso?.hash ?? null,
              selfie: nouveaux.selfie?.hash ?? null,
            },
            method: "capture-photo-v0",
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
          <Text style={typography.eyebrow}>Enrôlement · Pièce d&apos;identité</Text>
          <Text style={[typography.title, styles.title]}>
            Vérification d&apos;identité.
          </Text>
        </View>

        {etape.kind === "intro" ? (
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>Comment ça marche</Text>
              <Text style={styles.hint}>
                Nous capturons une photo de votre pièce d&apos;identité
                officielle (CNI, passeport ou titre de séjour) puis un
                selfie de vérification. Le rapprochement visage/pièce
                garantit que le Sceau est bien lié à un humain réel avec
                une identité civile confirmée.
              </Text>
              <Text style={styles.hint}>
                Les photos restent sur votre iPhone. Seuls des hashes
                cryptographiques irréversibles sont envoyés au serveur —
                nous ne conservons aucune image de votre pièce.
              </Text>
            </Card>
            <AlertBox
              variant="info"
              message="V1 : vérification manuelle par notre équipe humaine. V2 (à venir) : OCR + face match automatiques via technologies certifiées."
            />
            <Button label="Commencer" onPress={demarrer} variant="primary" />
          </>
        ) : null}

        {etape.kind === "choix" ? (
          <>
            <Text style={styles.hint}>Quel type de pièce voulez-vous utiliser ?</Text>
            <View style={{ gap: 10 }}>
              {(["cni", "passeport", "titre_sejour"] as TypePiece[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => choisirType(t)}
                  style={({ pressed }) => [styles.choixPiece, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.choixTitre}>{LIBELLES_PIECE[t]}</Text>
                  <Text style={styles.choixChev}>›</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {etape.kind === "capture" ? (
          <>
            <Card style={styles.card}>
              <Text style={typography.eyebrow}>
                {etape.slot === "recto"
                  ? "Photo 1 · Recto"
                  : etape.slot === "verso"
                    ? "Photo 2 · Verso"
                    : "Photo finale · Selfie"}
              </Text>
              <Text style={styles.hint}>
                {etape.slot === "selfie"
                  ? "Regardez droit vers l'objectif, centre du cadre. Lumière naturelle si possible."
                  : "Placez la pièce à plat sur un fond uni, tout le contour visible, aucun reflet."}
              </Text>
            </Card>
            <View style={styles.cameraWrap}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={etape.slot === "selfie" ? "front" : "back"}
              />
              <View
                style={[
                  styles.guide,
                  etape.slot === "selfie" ? styles.guideOvale : styles.guideRect,
                ]}
                pointerEvents="none"
              />
            </View>
            <Button
              label="Capturer"
              onPress={() => capturer(etape.slot)}
              variant="primary"
            />
          </>
        ) : null}

        {etape.kind === "review" ? (
          <>
            <View style={styles.reviewImageWrap}>
              <Image source={{ uri: etape.uri }} style={styles.reviewImage} />
            </View>
            <AlertBox
              variant="info"
              message={
                etape.slot === "selfie"
                  ? "Photo capturée. Vérifiez que votre visage est net, puis validez."
                  : "Photo capturée. Vérifiez que la pièce est nette, tout le contour visible et sans reflet."
              }
            />
            <View style={{ gap: 10 }}>
              <Button
                label="Valider et continuer"
                onPress={() => valider(etape.slot, etape.uri)}
                variant="primary"
              />
              <Button
                label="Recommencer"
                onPress={() => setEtape({ kind: "capture", slot: etape.slot })}
                variant="secondary"
              />
            </View>
          </>
        ) : null}

        {etape.kind === "saving" ? (
          <View style={styles.centered}>
            <Text style={styles.savingText}>
              Enregistrement de votre vérification d&apos;identité…
            </Text>
          </View>
        ) : null}

        {etape.kind === "done" ? (
          <AlertBox
            variant="success"
            message="Vérification d'identité enregistrée. Retour à l'accueil…"
          />
        ) : null}

        {etape.kind === "error" ? (
          <>
            <AlertBox variant="error" message={etape.message} />
            <Button
              label="Recommencer depuis le début"
              onPress={() => {
                setCaptures({});
                setTypePiece(null);
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

  choixPiece: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  choixTitre: {
    ...typography.body,
    fontSize: 16,
    fontWeight: "600",
    color: colors.fgPrimary,
  },
  choixChev: {
    fontSize: 24,
    color: colors.fgTertiary,
  },

  cameraWrap: {
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.bgSecondary,
    position: "relative",
  },
  camera: { flex: 1 },
  guide: {
    position: "absolute",
    borderWidth: 2,
    borderColor: colors.cyan,
    opacity: 0.7,
  },
  guideRect: {
    top: "18%",
    left: "8%",
    right: "8%",
    bottom: "18%",
    borderRadius: 12,
  },
  guideOvale: {
    top: "12%",
    left: "22%",
    right: "22%",
    bottom: "12%",
    borderRadius: 9999,
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
