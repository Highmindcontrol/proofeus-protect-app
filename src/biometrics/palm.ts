import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

/**
 * Utilitaires pour la biométrie de la paume — capture, empreinte, stockage.
 *
 * V0 : capture une photo de la paume ouverte face à la caméra arrière.
 * La photo est stockée dans un répertoire privé de l'app + hash SHA-256
 * calculé comme empreinte préliminaire.
 *
 * V1 (à venir) : segmentation via MediaPipe Hands (21 landmarks) +
 * extraction géométrique (longueur des doigts, ratios inter-articulaires)
 * + patterns visibles des lignes de vie/tête/cœur. Précision attendue
 * 85-90 %. Le réseau veineux profond (précision 99 %+) nécessite un
 * capteur infrarouge dédié — non disponible sur smartphone grand
 * public, prévu en évolution matérielle future.
 *
 * Aucune photo ne quitte jamais l'appareil. Seul le hash est
 * (éventuellement) envoyé au serveur.
 */

const PALM_DIR = `${FileSystem.documentDirectory}palm/`;

async function ensurePalmDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PALM_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PALM_DIR, { intermediates: true });
  }
}

export async function savePalmSample(
  sourceUri: string,
  slot: "reference" | "challenge",
): Promise<{ path: string; hash: string }> {
  await ensurePalmDir();
  const dest = `${PALM_DIR}${slot}.jpg`;

  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }

  await FileSystem.moveAsync({ from: sourceUri, to: dest });

  const base64 = await FileSystem.readAsStringAsync(dest, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
  );

  return { path: dest, hash };
}

export async function getPalmSample(
  slot: "reference" | "challenge",
): Promise<{ path: string; exists: boolean }> {
  const path = `${PALM_DIR}${slot}.jpg`;
  const info = await FileSystem.getInfoAsync(path);
  return { path, exists: info.exists };
}

export async function deleteAllPalmSamples(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PALM_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(PALM_DIR, { idempotent: true });
  }
}
