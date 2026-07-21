import CryptoJS from "crypto-js";

/**
 * Génération et vérification de codes TOTP (RFC 6238) pour la
 * vérification vocale entre membres d'un cercle Proofeus.
 *
 * Doctrine 21 juillet 2026 :
 *   - Fenêtre de 60 secondes (au lieu de 30 s par défaut Google
 *     Authenticator) pour laisser à l'utilisateur le temps de lire
 *     le code vocal et à l'autre de le taper sans stress
 *   - Tolérance de ±1 fenêtre à la vérification (donc code valide
 *     dans un intervalle de 60 s avant/après)
 *   - Clé partagée : base32 32 caractères (160 bits), générée côté
 *     serveur à la création du cercle et distribuée à tous les
 *     membres via RLS
 *   - Tous les membres du cercle voient le MÊME code au même moment,
 *     ce qui rend la vérification vocale triviale (« quel est ton
 *     code actuel ? » → « 842 517 » → tape la même chose de mon côté)
 *
 * Implémentation via crypto-js pour la portabilité React Native
 * (expo-crypto ne fournit pas HMAC-SHA1 directement).
 */

const FENETRE_SECONDES = 60;
const NB_CHIFFRES = 6;
const TOLERANCE_FENETRES = 1;

/**
 * Décode une chaîne base32 en séquence de bytes (Uint8Array).
 * Standard RFC 4648.
 */
function base32Decode(encoded: string): Uint8Array {
  const cleaned = encoded.replace(/=+$/, "").toUpperCase();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const c of cleaned) {
    const idx = chars.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Convertit un Uint8Array en WordArray crypto-js pour le HMAC.
 */
function bytesToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return CryptoJS.enc.Hex.parse(hex);
}

/**
 * Génère un code TOTP à 6 chiffres à partir d'une clé base32 et d'un
 * compteur (nombre de fenêtres écoulées depuis epoch). Implémentation
 * fidèle du RFC 6238 / RFC 4226 (HOTP).
 */
function genererCodeHotp(secretBase32: string, compteur: number): string {
  const cle = bytesToWordArray(base32Decode(secretBase32));

  // Compteur sur 8 octets big-endian
  const compteurBuf = new Uint8Array(8);
  let c = compteur;
  for (let i = 7; i >= 0; i--) {
    compteurBuf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const compteurWord = bytesToWordArray(compteurBuf);

  // HMAC-SHA1
  const hmac = CryptoJS.HmacSHA1(compteurWord, cle);
  const hmacHex = hmac.toString(CryptoJS.enc.Hex);

  // Dynamic Truncation (RFC 4226 §5.3)
  const offset = parseInt(hmacHex.slice(-1), 16);
  const binaireHex = hmacHex.slice(offset * 2, offset * 2 + 8);
  const binaire = parseInt(binaireHex, 16) & 0x7fffffff;

  const modulo = 10 ** NB_CHIFFRES;
  const code = binaire % modulo;
  return code.toString().padStart(NB_CHIFFRES, "0");
}

/**
 * Calcule le compteur TOTP courant à partir du timestamp système.
 */
function compteurCourant(timestampMs?: number): number {
  const t = timestampMs ?? Date.now();
  return Math.floor(t / 1000 / FENETRE_SECONDES);
}

/**
 * Génère le code TOTP actuellement valide pour un secret donné.
 */
export function genererCodeTotp(secretBase32: string, timestampMs?: number): string {
  return genererCodeHotp(secretBase32, compteurCourant(timestampMs));
}

/**
 * Retourne le nombre de secondes restantes avant que le code TOTP
 * courant expire. Utile pour afficher un compteur dans l'UI.
 */
export function secondesAvantRotation(timestampMs?: number): number {
  const t = timestampMs ?? Date.now();
  const secondesEcoulees = Math.floor(t / 1000);
  return FENETRE_SECONDES - (secondesEcoulees % FENETRE_SECONDES);
}

/**
 * Vérifie qu'un code saisi correspond au code TOTP courant du secret.
 * Tolère ±1 fenêtre (donc le code de la fenêtre précédente ou suivante
 * reste valide pour compenser les décalages d'horloge et le temps de
 * lecture vocale).
 */
export function verifierCodeTotp(
  secretBase32: string,
  codeSaisi: string,
  timestampMs?: number,
): boolean {
  const codePropre = codeSaisi.replace(/\s+/g, "");
  if (codePropre.length !== NB_CHIFFRES) return false;

  const compteur = compteurCourant(timestampMs);
  for (let delta = -TOLERANCE_FENETRES; delta <= TOLERANCE_FENETRES; delta++) {
    const code = genererCodeHotp(secretBase32, compteur + delta);
    if (code === codePropre) return true;
  }
  return false;
}

/**
 * Formate un code TOTP pour affichage : « 842517 » → « 842 517 »
 */
export function formaterCode(code: string): string {
  const propre = code.replace(/\s+/g, "");
  if (propre.length !== 6) return propre;
  return `${propre.slice(0, 3)} ${propre.slice(3)}`;
}

export const TOTP_FENETRE_SECONDES = FENETRE_SECONDES;
