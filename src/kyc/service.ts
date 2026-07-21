import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

/**
 * Utilitaires KYC — capture de pièce d'identité + selfie de vérification.
 *
 * V0 : capture des photos (recto + verso éventuel + selfie) via la
 * caméra, stockage local privé, calcul d'un hash SHA-256 par photo
 * comme empreinte préliminaire.
 *
 * V1 (à venir) : extraction OCR MRZ (Machine Readable Zone) + face
 * match automatique entre la photo de la pièce et le selfie via
 * ML Kit (Android) et Vision Framework (iOS), ou intégration Onfido /
 * Veriff pour la vérification tierce certifiée.
 *
 * Aucune photo ne quitte jamais l'appareil en clair — seuls les hashes
 * sont envoyés à Supabase.
 */

const KYC_DIR = `${FileSystem.documentDirectory}kyc/`;

export type TypePiece = "cni" | "passeport" | "titre_sejour";

export type SlotKyc = "recto" | "verso" | "selfie";

async function ensureKycDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(KYC_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(KYC_DIR, { intermediates: true });
  }
}

export async function saveKycSample(
  sourceUri: string,
  slot: SlotKyc,
): Promise<{ path: string; hash: string }> {
  await ensureKycDir();
  const dest = `${KYC_DIR}${slot}.jpg`;

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

export async function getKycSample(
  slot: SlotKyc,
): Promise<{ path: string; exists: boolean }> {
  const path = `${KYC_DIR}${slot}.jpg`;
  const info = await FileSystem.getInfoAsync(path);
  return { path, exists: info.exists };
}

export async function deleteAllKycSamples(): Promise<void> {
  const info = await FileSystem.getInfoAsync(KYC_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(KYC_DIR, { idempotent: true });
  }
}

export const LIBELLES_PIECE: Record<TypePiece, string> = {
  cni: "Carte nationale d'identité",
  passeport: "Passeport",
  titre_sejour: "Titre de séjour",
};

export function pieceANecessiteVerso(type: TypePiece): boolean {
  return type === "cni" || type === "titre_sejour";
}
