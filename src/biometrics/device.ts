import * as LocalAuthentication from "expo-local-authentication";

/**
 * Interface avec la biométrie native de l'appareil.
 *
 * Sur iOS : Face ID ou Touch ID via LAContext + Secure Enclave.
 * Sur Android : BiometricPrompt + Titan M / Keystore hardware.
 *
 * Les données biométriques restent EN PERMANENCE dans le hardware
 * sécurisé de l'appareil. Nous recevons uniquement un booléen de
 * réussite/échec et un jeton signé cryptographiquement.
 *
 * Précision attendue : 99,9 % (niveau militaire pour Face ID / Touch ID).
 */

export type DeviceBiometricSupport = {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: Array<"fingerprint" | "facial" | "iris">;
};

export async function checkDeviceBiometricSupport(): Promise<DeviceBiometricSupport> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const rawTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

  const supportedTypes: DeviceBiometricSupport["supportedTypes"] = [];
  if (rawTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    supportedTypes.push("fingerprint");
  }
  if (rawTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    supportedTypes.push("facial");
  }
  if (rawTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    supportedTypes.push("iris");
  }

  return { hasHardware, isEnrolled, supportedTypes };
}

/**
 * Doctrine (21 juillet 2026) : la biométrie Proofeus DOIT être
 * biométrique. On désactive explicitement le fallback passcode iPhone
 * pour éviter deux problèmes :
 *
 * 1. iOS demande le passcode d'écran à Expo Go (app générique) avant
 *    d'autoriser Face ID → l'app passe en background, le state React
 *    se perd, le modal Ping disparaît sans confirmation.
 *
 * 2. Doctrinalement, un imposteur qui a le téléphone déverrouillé ne
 *    doit rien pouvoir confirmer avec le passcode — l'USP Proofeus est
 *    justement la biométrie exclusive, pas la connaissance d'un code.
 *
 * disableDeviceFallback: true force Face ID pur. Si Face ID échoue
 * (mauvais visage, luminosité, etc.), l'auth retourne error au lieu
 * de basculer sur le passcode iPhone.
 */
export async function authenticateDeviceBiometric(
  reason: string = "Prouvez votre humanité",
): Promise<{ success: boolean; error?: string }> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Annuler",
    disableDeviceFallback: true,
  });

  if (result.success) {
    return { success: true };
  }
  return {
    success: false,
    error: "error" in result ? result.error : "Échec de la vérification",
  };
}
