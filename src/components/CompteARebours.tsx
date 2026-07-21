import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

/**
 * Compte à rebours 3-2-1 avant une capture biométrique. Chaque chiffre
 * s'anime en scale + opacity pendant 1 seconde. Émet onFini() quand la
 * séquence est complète. Sert à laisser à l'utilisateur le temps de
 * se positionner correctement — ressenti « sérieux d'une vraie capture ».
 */
export function CompteARebours({
  duree = 3,
  onFini,
  couleur = colors.cyan,
}: {
  duree?: number;
  onFini: () => void;
  couleur?: string;
}) {
  const [valeur, setValeur] = useState(duree);
  const scale = new Animated.Value(0.5);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const interval = setInterval(() => {
      setValeur((v) => {
        if (v <= 1) {
          clearInterval(interval);
          setTimeout(onFini, 400);
          return 0;
        }
        scale.setValue(0.5);
        opacity.setValue(0);
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
          Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();
        return v - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.wrap}>
      <Animated.Text
        style={[
          styles.chiffre,
          { color: couleur, opacity, transform: [{ scale }] },
        ]}
      >
        {valeur > 0 ? valeur : "✓"}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  chiffre: {
    fontSize: 120,
    fontWeight: "800",
    letterSpacing: -4,
    fontVariant: ["tabular-nums"],
  },
});
