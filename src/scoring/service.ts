/**
 * Fusion multi-modale + scoring de confiance (Sprint 8).
 *
 * À chaque preuve d'humanité générée, on calcule un score global de
 * confiance qui combine les précisions cibles de chaque modalité
 * enrôlée. La formule est celle de la combinaison probabiliste de
 * sources indépendantes :
 *
 *   score = 1 - Π(1 - précision_i) pour chaque modalité active
 *
 * Résultat : le score approche 100 % dès qu'on cumule 2+ modalités
 * fortes, ce qui est cohérent avec la doctrine « > 99,5 % en fusion »
 * (mémoire technique solo 4 juillet 2026).
 *
 * Précisions cibles documentées :
 *   - Morphologie 3D (Face ID / ARKit)      : 99,9 %
 *   - Détection du vivant (PPG + défis)     : 95 %   (V2 — pas encore)
 *   - Voix + challenge vocal aléatoire      : 94 %   (moyenne 92-96)
 *   - Paume (géométrie + lignes)            : 87,5 % (moyenne 85-90)
 *   - Iris (caméra RGB)                     : 80 %   (moyenne 70-90 selon
 *                                                     couleur d'œil)
 *   - KYC (pièce + selfie vérification)     : 95 %   (contribution forte)
 */

export type ModaliteScoring =
  | "voice"
  | "face"
  | "iris"
  | "palm"
  | "liveness"
  | "kyc";

export const PRECISION_CIBLE: Record<ModaliteScoring, number> = {
  face: 0.999,
  liveness: 0.95,
  kyc: 0.95,
  voice: 0.94,
  palm: 0.875,
  iris: 0.8,
};

export const LIBELLE_MODALITE: Record<ModaliteScoring, string> = {
  face: "Morphologie 3D",
  voice: "Voix + challenge",
  iris: "Iris",
  palm: "Paume",
  liveness: "Détection du vivant",
  kyc: "Identité vérifiée",
};

export type NiveauConfiance = "faible" | "bon" | "eleve" | "tres_eleve" | "maximal";

export type ScoreConfiance = {
  score: number;                        // 0-100, deux décimales
  modalitesActives: ModaliteScoring[];
  niveau: NiveauConfiance;
  libelleNiveau: string;
};

/**
 * Calcule le score global de confiance à partir de l'enrolment_status
 * de l'utilisateur (JSONB stocké dans protect_users).
 */
export function calculerScoreConfiance(
  enrolment: Record<string, unknown>,
): ScoreConfiance {
  const modalitesActives: ModaliteScoring[] = [];
  const precisions: number[] = [];

  (Object.keys(PRECISION_CIBLE) as ModaliteScoring[]).forEach((m) => {
    if (enrolment[m]) {
      modalitesActives.push(m);
      precisions.push(PRECISION_CIBLE[m]);
    }
  });

  if (modalitesActives.length === 0) {
    return {
      score: 0,
      modalitesActives: [],
      niveau: "faible",
      libelleNiveau: "Aucune modalité enrôlée",
    };
  }

  // Fusion : 1 - Π(1 - précision_i)
  const erreurCombinee = precisions.reduce((acc, p) => acc * (1 - p), 1);
  const score = Math.round((1 - erreurCombinee) * 10000) / 100;

  const { niveau, libelleNiveau } = classerNiveau(score, modalitesActives.length);

  return { score, modalitesActives, niveau, libelleNiveau };
}

function classerNiveau(
  score: number,
  nbModalites: number,
): { niveau: NiveauConfiance; libelleNiveau: string } {
  if (nbModalites >= 4 && score >= 99.9) {
    return { niveau: "maximal", libelleNiveau: "Confiance maximale" };
  }
  if (score >= 99.5) {
    return { niveau: "tres_eleve", libelleNiveau: "Confiance très élevée" };
  }
  if (score >= 95) {
    return { niveau: "eleve", libelleNiveau: "Confiance élevée" };
  }
  if (score >= 85) {
    return { niveau: "bon", libelleNiveau: "Confiance bonne" };
  }
  return { niveau: "faible", libelleNiveau: "Confiance faible" };
}

/**
 * Couleur associée au niveau, utile pour l'affichage (jauge / badge).
 * Utilise les tokens de theme/colors.ts.
 */
export function couleurNiveau(niveau: NiveauConfiance): string {
  switch (niveau) {
    case "maximal":
    case "tres_eleve":
      return "#3fd4d9"; // cyan Proofeus
    case "eleve":
      return "#10b981"; // emerald
    case "bon":
      return "#f59e0b"; // amber
    case "faible":
      return "#dc2626"; // rouge
  }
}
