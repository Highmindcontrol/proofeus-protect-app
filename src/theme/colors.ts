/**
 * Palette Proofeus Protect — charte AtaraxisIA cohérente avec le site web.
 * Noir profond + cyan/turquoise signature, glass sombre pour panneaux.
 */

export const colors = {
  // Fondations
  bgPrimary: "#0a0a0a",
  bgSecondary: "#141416",
  bgTertiary: "#1c1c1f",
  bgElevated: "rgba(28, 28, 32, 0.6)",

  // Texte
  fgPrimary: "#f5f5f7",
  fgSecondary: "#b8b8c4",
  fgTertiary: "#7a7a8a",
  fgMuted: "#5a5a68",

  // Cyan Proofeus
  cyan: "#3fd4d9",
  cyanBright: "#22d3ee",
  cyanDeep: "#0e7490",
  cyanSoft: "rgba(63, 212, 217, 0.08)",
  cyanGlow: "rgba(63, 212, 217, 0.25)",

  // Bordures
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(255, 255, 255, 0.18)",
  borderCyan: "rgba(63, 212, 217, 0.35)",

  // Rouge alerte (Sécurité+)
  redAlert: "#a63232",
  redAlertBright: "#c94848",

  // Vert live/succès
  emerald: "#10b981",
} as const;
