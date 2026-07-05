import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

/**
 * Utilitaires pour la biométrie morphologique 3D — capture, empreinte, stockage.
 *
 * V0 (approche A) : capture une photo via la caméra frontale + validation
 * Face ID native. La photo est stockée dans un répertoire privé de l'app
 * et on calcule un hash SHA-256 comme empreinte préliminaire.
 *
 * Face ID sur iPhone utilise le module TrueDepth (~30 000 points 3D
 * projetés en infrarouge) — c'est déjà de la vraie morphologie 3D côté
 * hardware, opaque via LocalAuthentication. La photo caméra frontale
 * sert d'ancre visuelle + de matériau pour la V1 (extraction de vecteur
 * facial ARKit ARFaceAnchor prévue en approche B).
 *
 * Aucune photo ne quitte jamais l'appareil. Seul le hash est
 * (éventuellement) envoyé au serveur.
 */

const FACE_DIR = `${FileSystem.documentDirectory}face/`;

async function ensureFaceDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(FACE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(FACE_DIR, { intermediates: true });
  }
}

export async function saveFaceSample(
  sourceUri: string,
  slot: "reference" | "challenge",
): Promise<{ path: string; hash: string }> {
  await ensureFaceDir();
  const dest = `${FACE_DIR}${slot}.jpg`;

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

export async function getFaceSample(
  slot: "reference" | "challenge",
): Promise<{ path: string; exists: boolean }> {
  const path = `${FACE_DIR}${slot}.jpg`;
  const info = await FileSystem.getInfoAsync(path);
  return { path, exists: info.exists };
}

export async function deleteAllFaceSamples(): Promise<void> {
  const info = await FileSystem.getInfoAsync(FACE_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(FACE_DIR, { idempotent: true });
  }
}
