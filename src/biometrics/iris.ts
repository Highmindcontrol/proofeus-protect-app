import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

/**
 * Utilitaires pour la biométrie de l'iris — capture, empreinte, stockage.
 *
 * V0 : capture une photo cadrée sur les yeux via la caméra frontale.
 * La photo est stockée dans un répertoire privé de l'app + hash SHA-256
 * calculé comme empreinte préliminaire.
 *
 * V1 (à venir) : segmentation d'iris via MediaPipe Iris + extraction
 * du descripteur de Daugman (2048 bits de code d'iris) via OpenCV. La
 * précision par caméra RGB dépend fortement de la couleur d'œil —
 * 70 à 90 % selon les cas — c'est pour cette raison qu'on ajoute l'iris
 * en complément des 4 autres modalités, jamais seul.
 *
 * Aucune photo ne quitte jamais l'appareil. Seul le hash est
 * (éventuellement) envoyé au serveur.
 */

const IRIS_DIR = `${FileSystem.documentDirectory}iris/`;

async function ensureIrisDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IRIS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IRIS_DIR, { intermediates: true });
  }
}

export async function saveIrisSample(
  sourceUri: string,
  slot: "reference" | "challenge",
): Promise<{ path: string; hash: string }> {
  await ensureIrisDir();
  const dest = `${IRIS_DIR}${slot}.jpg`;

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

export async function getIrisSample(
  slot: "reference" | "challenge",
): Promise<{ path: string; exists: boolean }> {
  const path = `${IRIS_DIR}${slot}.jpg`;
  const info = await FileSystem.getInfoAsync(path);
  return { path, exists: info.exists };
}

export async function deleteAllIrisSamples(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IRIS_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(IRIS_DIR, { idempotent: true });
  }
}
