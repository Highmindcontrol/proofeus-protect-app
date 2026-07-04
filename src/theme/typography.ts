import { StyleSheet } from "react-native";
import { colors } from "./colors";

/**
 * Système typographique Proofeus Protect — équivalent React Native de
 * la palette du site web. Font system natives (San Francisco iOS, Roboto
 * Android) via -apple-system équivalent — Expo gère automatiquement.
 */

export const typography = StyleSheet.create({
  hero: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 44,
    color: colors.fgPrimary,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 32,
    color: colors.fgPrimary,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.2,
    lineHeight: 26,
    color: colors.fgPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
    color: colors.fgSecondary,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    color: colors.fgPrimary,
  },
  caption: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.3,
    color: colors.fgTertiary,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.cyan,
  },
  mono: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Courier New",
    letterSpacing: 0.5,
    color: colors.fgTertiary,
  },
});
