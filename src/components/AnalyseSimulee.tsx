import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

/**
 * Phase d'analyse simulée entre deux captures biométriques. Affiche
 * un anneau de progression cyan qui tourne + un texte défilant
 * décrivant les étapes de traitement. Sert à donner un ressenti de
 * profondeur technique — l'utilisateur perçoit que l'app fait un vrai
 * travail derrière la capture, pas juste un « boom photo terminé ».
 *
 * V0 : phases scriptées avec durée fixe (~2-3 s). V1 (post-ARKit) :
 * les phases refléteront les vraies étapes du pipeline biométrique.
 */

const PHASES_PAR_TYPE: Record<string, string[]> = {
  face: [
    "Détection des points caractéristiques",
    "Extraction de la géométrie faciale",
    "Calcul du descripteur biométrique",
    "Chiffrement et enregistrement",
  ],
  iris: [
    "Segmentation de l'iris",
    "Analyse du pattern rétinien",
    "Calcul du code d'iris",
    "Chiffrement et enregistrement",
  ],
  palm: [
    "Détection des lignes de la paume",
    "Extraction de la géométrie",
    "Calcul du descripteur",
    "Chiffrement et enregistrement",
  ],
  voice: [
    "Analyse spectrale de la voix",
    "Extraction des fréquences propres",
    "Calcul du descripteur vocal",
    "Chiffrement et enregistrement",
  ],
  kyc: [
    "Analyse de la pièce d'identité",
    "Extraction des zones lisibles",
    "Rapprochement visage / pièce",
    "Chiffrement et enregistrement",
  ],
  liveness: [
    "Analyse du défi visuel",
    "Corrélation micro-mouvements",
    "Vérification de présence",
    "Chiffrement et enregistrement",
  ],
};

const DEFAUT_PHASES = [
  "Analyse en cours",
  "Extraction du descripteur",
  "Chiffrement et enregistrement",
];

export function AnalyseSimulee({
  type,
  duree = 2500,
  onFini,
}: {
  type?: keyof typeof PHASES_PAR_TYPE;
  duree?: number;
  onFini: () => void;
}) {
  const phases = type ? PHASES_PAR_TYPE[type] : DEFAUT_PHASES;
  const [phaseIdx, setPhaseIdx] = useState(0);
  const rotation = useRef(new Animated.Value(0)).current;
  const fadeText = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  useEffect(() => {
    const dureeParPhase = duree / phases.length;
    const interval = setInterval(() => {
      setPhaseIdx((i) => {
        if (i >= phases.length - 1) {
          clearInterval(interval);
          setTimeout(onFini, 400);
          return i;
        }
        Animated.sequence([
          Animated.timing(fadeText, { toValue: 0, duration: 150, useNativeDriver: true }),
          Animated.timing(fadeText, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        return i + 1;
      });
    }, dureeParPhase);
    return () => clearInterval(interval);
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.anneauWrap}>
        <Animated.View style={[styles.anneau, { transform: [{ rotate: spin }] }]} />
        <View style={styles.centre}>
          <View style={styles.point} />
        </View>
      </View>
      <Animated.Text style={[styles.texte, { opacity: fadeText }]}>
        {phases[phaseIdx]}…
      </Animated.Text>
      <View style={styles.pointsProgression}>
        {phases.map((_, i) => (
          <View
            key={i}
            style={[styles.pointProg, i <= phaseIdx && styles.pointProgActif]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 20,
  },
  anneauWrap: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  anneau: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.cyan,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  centre: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  point: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.cyan,
  },
  texte: {
    ...typography.body,
    fontSize: 15,
    color: colors.fgSecondary,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  pointsProgression: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  pointProg: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  pointProgActif: {
    backgroundColor: colors.cyan,
  },
});
