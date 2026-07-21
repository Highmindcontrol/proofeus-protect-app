import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

/**
 * Barre visuelle de progression pour les enrôlements multi-étapes.
 * Affiche « Étape X/Y · Libellé » + une jauge remplie proportionnelle.
 */
export function BarreProgressionEnrolement({
  etapeActuelle,
  etapes,
}: {
  etapeActuelle: number;
  etapes: string[];
}) {
  const total = etapes.length;
  const pct = Math.min(100, Math.round((etapeActuelle / total) * 100));

  return (
    <View style={styles.wrap}>
      <View style={styles.entete}>
        <Text style={styles.label}>
          Étape {Math.min(etapeActuelle, total)} / {total}
        </Text>
        <Text style={styles.etapeLibelle}>
          {etapes[Math.min(etapeActuelle - 1, total - 1)]}
        </Text>
      </View>
      <View style={styles.jauge}>
        <View style={[styles.jaugeRempli, { width: `${pct}%` }]} />
      </View>
      <View style={styles.puces}>
        {etapes.map((_, i) => {
          const complet = i < etapeActuelle;
          const actif = i === etapeActuelle - 1;
          return (
            <View
              key={i}
              style={[
                styles.puce,
                complet && styles.puceComplete,
                actif && styles.puceActive,
              ]}
            >
              {complet && !actif ? <Text style={styles.check}>✓</Text> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    padding: 14,
    backgroundColor: "rgba(63,212,217,0.05)",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(63,212,217,0.25)",
  },
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  label: {
    ...typography.caption,
    color: colors.cyan,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  etapeLibelle: {
    ...typography.body,
    fontSize: 13,
    color: colors.fgPrimary,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  jauge: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    overflow: "hidden",
  },
  jaugeRempli: {
    height: "100%",
    backgroundColor: colors.cyan,
    borderRadius: 999,
  },
  puces: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  puce: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  puceComplete: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan,
  },
  puceActive: {
    borderColor: colors.cyan,
    borderWidth: 2.5,
    backgroundColor: "rgba(63,212,217,0.25)",
  },
  check: {
    color: colors.bgPrimary,
    fontSize: 10,
    fontWeight: "800",
  },
});
