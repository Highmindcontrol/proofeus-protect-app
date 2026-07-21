import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { Accelerometer } from "expo-sensors";

/**
 * Utilitaires pour la détection du vivant — capture vidéo d'un défi
 * aléatoire + mesure des micro-mouvements par accéléromètre.
 *
 * V0 : trois signaux combinés côté device pour prouver la présence
 * physique de l'utilisateur au moment de l'enrôlement :
 *
 *   1. Défi visuel aléatoire (« clignez de l'œil », « tournez la tête »,
 *      etc.) — vidéo courte capturée, hash SHA-256 comme empreinte
 *      préliminaire. La phrase de défi est tirée au sort à chaque
 *      enrôlement pour empêcher les enregistrements préalables.
 *
 *   2. Test accéléromètre — l'utilisateur tient le téléphone pendant
 *      3 secondes. On mesure la variance des magnitudes 3D à 60 Hz.
 *      Un humain qui tient son téléphone a toujours des micro-tremblements
 *      naturels (0.05 à 0.5 m/s²). Un support/dock immobile a une
 *      variance quasi-nulle. Un téléphone en mouvement violent a une
 *      variance très haute (posé sur un objet en vibration).
 *
 * V1 (post-launch) : ajouter le PPG (photoplethysmographie) — analyse
 * frame-par-frame de la couleur du visage pour extraire le rythme
 * cardiaque. Nécessite un module natif custom (FFT sur canal rouge),
 * incompatible Expo Go.
 *
 * V1.5 : analyse ML des mouvements du défi (le sourire est-il un vrai
 * sourire ? le clin d'œil est-il vraiment sur l'œil demandé ?) via
 * MediaPipe FaceLandmarker ou modèle custom TF Lite.
 *
 * Aucune vidéo ne quitte jamais l'appareil. Seul le hash est envoyé.
 */

const LIVENESS_DIR = `${FileSystem.documentDirectory}liveness/`;

async function ensureLivenessDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LIVENESS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LIVENESS_DIR, { intermediates: true });
  }
}

export async function saveLivenessSample(
  sourceUri: string,
  slot: "defi" | "accelerometre",
): Promise<{ path: string; hash: string }> {
  await ensureLivenessDir();
  const ext = slot === "defi" ? ".mp4" : ".json";
  const dest = `${LIVENESS_DIR}${slot}${ext}`;

  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }

  if (sourceUri.startsWith("file://") || sourceUri.startsWith("/")) {
    await FileSystem.moveAsync({ from: sourceUri, to: dest });
  } else {
    // Contenu texte (accéléromètre) — on l'écrit directement
    await FileSystem.writeAsStringAsync(dest, sourceUri);
  }

  const base64 = await FileSystem.readAsStringAsync(dest, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
  );

  return { path: dest, hash };
}

export async function deleteAllLivenessSamples(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LIVENESS_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(LIVENESS_DIR, { idempotent: true });
  }
}

/* -------------------------------------------------------------------------- */
/* Défis aléatoires — tirés au hasard pour empêcher les enregistrements       */
/* préalables ou les deepfakes vidéo statiques.                               */
/* -------------------------------------------------------------------------- */

export type Defi = {
  cle: string;
  instruction: string;
  duree_ms: number;
};

const DEFIS: Defi[] = [
  { cle: "cligne_droit", instruction: "Clignez de l'œil droit deux fois", duree_ms: 3000 },
  { cle: "cligne_gauche", instruction: "Clignez de l'œil gauche deux fois", duree_ms: 3000 },
  { cle: "tourne_gauche", instruction: "Tournez lentement la tête vers la gauche", duree_ms: 4000 },
  { cle: "tourne_droite", instruction: "Tournez lentement la tête vers la droite", duree_ms: 4000 },
  { cle: "sourire_large", instruction: "Souriez largement pendant 3 secondes", duree_ms: 3000 },
  { cle: "hoche_tete", instruction: "Hochez doucement la tête de haut en bas", duree_ms: 4000 },
  { cle: "leve_sourcils", instruction: "Levez les sourcils deux fois de suite", duree_ms: 3000 },
];

export function tirerDefiAleatoire(): Defi {
  const i = Math.floor(Math.random() * DEFIS.length);
  return DEFIS[i];
}

/* -------------------------------------------------------------------------- */
/* Mesure accéléromètre — capture 3 s à 60 Hz, calcule variance des         */
/* magnitudes 3D pour distinguer main humaine vs support immobile.            */
/* -------------------------------------------------------------------------- */

export type MesureAccelerometre = {
  echantillons: number;
  duree_ms: number;
  variance_magnitude: number;
  verdict: "immobile_suspect" | "humain_probable" | "trop_agite";
};

export async function mesurerAccelerometre(
  dureeMs = 3000,
): Promise<MesureAccelerometre> {
  Accelerometer.setUpdateInterval(16); // ~60 Hz

  const magnitudes: number[] = [];
  const debut = Date.now();

  const subscription = Accelerometer.addListener(({ x, y, z }) => {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    magnitudes.push(magnitude);
  });

  await new Promise((resolve) => setTimeout(resolve, dureeMs));
  subscription.remove();

  const dureeReelle = Date.now() - debut;

  if (magnitudes.length === 0) {
    return {
      echantillons: 0,
      duree_ms: dureeReelle,
      variance_magnitude: 0,
      verdict: "immobile_suspect",
    };
  }

  const moyenne = magnitudes.reduce((s, m) => s + m, 0) / magnitudes.length;
  const variance =
    magnitudes.reduce((s, m) => s + Math.pow(m - moyenne, 2), 0) / magnitudes.length;

  // Seuils empiriques (à affiner) :
  //   < 0.0002 → téléphone posé, très suspect
  //   0.0002 - 0.05 → main humaine tenant naturellement l'appareil
  //   > 0.05 → mouvement trop violent, capture peu fiable
  let verdict: MesureAccelerometre["verdict"];
  if (variance < 0.0002) verdict = "immobile_suspect";
  else if (variance > 0.05) verdict = "trop_agite";
  else verdict = "humain_probable";

  return {
    echantillons: magnitudes.length,
    duree_ms: dureeReelle,
    variance_magnitude: variance,
    verdict,
  };
}
