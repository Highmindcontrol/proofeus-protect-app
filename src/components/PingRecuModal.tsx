import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { authenticateDeviceBiometric } from "@/biometrics/device";
import { confirmerPing, refuserPing, type Ping } from "@/pings/service";

/**
 * Modal plein écran qui apparaît quand un ping entrant est détecté.
 *
 * Doctrine : le destinataire DOIT passer Face ID pour confirmer
 * l'authenticité de sa réponse. C'est le vrai USP de Proofeus vs
 * Google/Microsoft Authenticator qui laissent juste taper Confirmer
 * sans biométrie. Un voleur qui a le téléphone ne peut RIEN valider
 * sans être le vrai propriétaire biométriquement.
 */
export function PingRecuModal({
  ping,
  onRepondu,
  onFerme,
}: {
  ping: Ping | null;
  onRepondu: () => void;
  onFerme: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ping) return null;

  const restantMs = new Date(ping.expires_at).getTime() - Date.now();
  const restantMin = Math.max(0, Math.ceil(restantMs / 60000));

  async function surConfirmation() {
    if (!ping) return;
    setErreur(null);
    setEnCours(true);
    try {
      const auth = await authenticateDeviceBiometric(
        "Proofeus — confirmez votre humanité avec Face ID pour répondre à ce ping",
      );
      if (!auth.success) {
        setErreur(
          auth.error ??
            "Face ID a échoué. Réessayez ou refusez ce ping si ce n'est pas vous.",
        );
        return;
      }
      await confirmerPing(ping.id);
      onRepondu();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(false);
    }
  }

  async function surRefus() {
    if (!ping) return;
    setErreur(null);
    setEnCours(true);
    try {
      await refuserPing(ping.id);
      onRepondu();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal transparent animationType="fade" visible={true}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.pingBadge}>
            <Text style={styles.pingBadgeTexte}>PING PROOFEUS</Text>
          </View>
          <Text style={styles.titre}>
            {ping.emetteur_prenom
              ? `${ping.emetteur_prenom} vous demande`
              : "Un membre de votre cercle vous demande"}
          </Text>
          <Text style={styles.sousTitre}>une preuve d&apos;humanité</Text>

          {ping.message ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageTexte}>« {ping.message} »</Text>
            </View>
          ) : null}

          <View style={styles.infoBox}>
            <Text style={styles.infoTexte}>
              Confirmer nécessite <Text style={styles.strong}>Face ID</Text> —
              impossible à valider sans être vraiment vous, même si quelqu&apos;un
              tenait votre téléphone en main.
            </Text>
          </View>

          {erreur ? (
            <View style={styles.erreurBox}>
              <Text style={styles.erreurTexte}>{erreur}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button
              label={enCours ? "Vérification…" : "Confirmer avec Face ID"}
              onPress={surConfirmation}
              variant="primary"
              disabled={enCours}
            />
            <Button
              label="Ce n'est pas moi — refuser"
              onPress={surRefus}
              variant="secondary"
              disabled={enCours}
            />
            <Pressable onPress={onFerme} hitSlop={12} style={styles.plusTard}>
              <Text style={styles.plusTardTexte}>Décider plus tard</Text>
            </Pressable>
          </View>

          <Text style={styles.expire}>
            Ce ping expire dans {restantMin} minute{restantMin > 1 ? "s" : ""}.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.bgSecondary,
    borderRadius: 24,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.cyan,
  },
  pingBadge: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(63,212,217,0.15)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cyan,
  },
  pingBadgeTexte: {
    ...typography.caption,
    color: colors.cyan,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
  },
  titre: {
    ...typography.title,
    fontSize: 22,
    color: colors.fgPrimary,
    textAlign: "center",
  },
  sousTitre: {
    ...typography.body,
    fontSize: 16,
    color: colors.cyan,
    textAlign: "center",
    marginTop: -8,
  },
  messageBox: {
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.cyan,
    marginTop: 4,
  },
  messageTexte: {
    ...typography.body,
    fontSize: 13,
    color: colors.fgSecondary,
    fontStyle: "italic",
  },
  infoBox: {
    padding: 12,
    backgroundColor: "rgba(63,212,217,0.06)",
    borderRadius: 10,
  },
  infoTexte: {
    ...typography.caption,
    color: colors.fgSecondary,
    lineHeight: 18,
  },
  strong: {
    color: colors.cyan,
    fontWeight: "700",
  },
  erreurBox: {
    padding: 12,
    backgroundColor: "rgba(220,38,38,0.08)",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(220,38,38,0.3)",
  },
  erreurTexte: {
    ...typography.caption,
    color: "#f87171",
  },
  actions: {
    gap: 10,
    marginTop: 6,
  },
  plusTard: {
    alignItems: "center",
    paddingVertical: 8,
  },
  plusTardTexte: {
    ...typography.caption,
    color: colors.fgTertiary,
    textDecorationLine: "underline",
  },
  expire: {
    ...typography.caption,
    color: colors.fgMuted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 8,
  },
});
