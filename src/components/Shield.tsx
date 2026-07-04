import { StyleSheet, View, Animated, Easing } from "react-native";
import { useEffect, useRef } from "react";
import { colors } from "@/theme/colors";

/**
 * Bouclier Proofeus SVG-like animé — halo pulsé qui bat calmement.
 * Reprend visuellement la pupille qui bat de la home Watch, adaptée
 * pour le hero de l'app mobile.
 */
export function Shield({ size = 200 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.15],
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.7],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Halo cyan pulsé */}
      <Animated.View
        style={[
          styles.halo,
          {
            width: size * 1.4,
            height: size * 1.4,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />

      {/* Forme bouclier stylisée en CSS */}
      <View style={[styles.shieldOuter, { width: size, height: size }]}>
        <View style={[styles.shieldInner, { width: size * 0.75, height: size * 0.75 }]}>
          <View style={[styles.pupil, { width: size * 0.12, height: size * 0.12 }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: colors.cyan,
  },
  shieldOuter: {
    borderWidth: 3,
    borderColor: colors.cyan,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSecondary,
  },
  shieldInner: {
    borderWidth: 1.5,
    borderColor: colors.cyanDeep,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pupil: {
    borderRadius: 9999,
    backgroundColor: colors.cyan,
  },
});
