import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

/**
 * Utilitaires pour la biométrie vocale — capture, empreinte, stockage.
 *
 * V0 : on capture un fichier audio via expo-audio dans un composant
 * React, on le stocke dans un répertoire privé de l'app (accessible
 * uniquement à Proofeus Protect), et on calcule un hash SHA-256 comme
 * empreinte « préliminaire » — ce hash sera remplacé par un vrai
 * voice embedding (ECAPA-TDNN via TF Lite) dans un sprint futur.
 *
 * Aucun fichier audio ne quitte jamais l'appareil. Seul le hash est
 * (éventuellement) envoyé au serveur.
 */

const VOICE_DIR = `${FileSystem.documentDirectory}voice/`;

async function ensureVoiceDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VOICE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(VOICE_DIR, { intermediates: true });
  }
}

export async function saveVoiceSample(
  sourceUri: string,
  slot: "reference" | "challenge",
): Promise<{ path: string; hash: string }> {
  await ensureVoiceDir();
  const dest = `${VOICE_DIR}${slot}.m4a`;

  // Si un fichier existe déjà à ce slot, on le remplace
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }

  await FileSystem.moveAsync({ from: sourceUri, to: dest });

  // Hash du contenu — sera remplacé par un vrai embedding vocal en V2
  const base64 = await FileSystem.readAsStringAsync(dest, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
  );

  return { path: dest, hash };
}

export async function getVoiceSample(
  slot: "reference" | "challenge",
): Promise<{ path: string; exists: boolean }> {
  const path = `${VOICE_DIR}${slot}.m4a`;
  const info = await FileSystem.getInfoAsync(path);
  return { path, exists: info.exists };
}

export async function deleteAllVoiceSamples(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VOICE_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(VOICE_DIR, { idempotent: true });
  }
}

/* -------------------------------------------------------------------------- */
/* Phrases de challenge — tirées au hasard pour empêcher les enregistrements  */
/* préalables de deepfakes vocaux                                             */
/* -------------------------------------------------------------------------- */

const CHALLENGE_PHRASES = [
  "La preuve d'humanité vaut mieux que la meilleure des serrures.",
  "Aujourd'hui, je prouve que je suis moi.",
  "Ma voix, mon regard, ma paume, ma présence.",
  "Aucune machine ne peut être moi à ma place.",
  "Le vrai me défend contre le faux qui m'imite.",
  "Je signe cette conversation de ma présence vivante.",
  "Cinq signaux, trois secondes, une humanité.",
  "Ceux que j'aime méritent que je sois vraiment moi.",
  "Ma parole ne se contrefait pas.",
  "L'attention est le premier des courages.",
];

export function pickRandomChallengePhrase(): string {
  const i = Math.floor(Math.random() * CHALLENGE_PHRASES.length);
  return CHALLENGE_PHRASES[i];
}

/**
 * Phrase de référence — la même pour tous les utilisateurs, pour établir
 * une base commune de comparaison. Sera prononcée lors de l'enrôlement.
 */
export const REFERENCE_PHRASE =
  "Je suis moi, je suis vivant, je suis ici, en ce moment précis.";
