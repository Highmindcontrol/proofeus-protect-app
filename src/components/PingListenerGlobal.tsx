import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { listerPingsEntrants, type Ping } from "@/pings/service";
import { PingRecuModal } from "./PingRecuModal";

/**
 * Écouteur global des pings entrants, monté dans le layout de l'app
 * authentifiée. Contrairement au polling local à l'écran /cercle, il
 * tourne dès que le user est connecté, indépendamment de l'écran
 * affiché.
 *
 * Trois déclencheurs de poll :
 *   1. Au montage
 *   2. Toutes les 5 secondes tant que l'app est active
 *   3. À chaque retour au foreground (AppState → 'active') — capital
 *      pour rattraper un ping arrivé pendant que le téléphone était
 *      verrouillé
 *
 * En V0 Expo Go, c'est le fallback aux vraies push notifications
 * distantes (bloquées sans dev-client + Apple Developer). Le modal
 * plein-écran surgit dès qu'un ping en_attente est détecté.
 */
export function PingListenerGlobal() {
  const [pingEntrant, setPingEntrant] = useState<Ping | null>(null);
  const pingEntrantRef = useRef<Ping | null>(null);
  pingEntrantRef.current = pingEntrant;

  useEffect(() => {
    let annule = false;

    async function poll() {
      try {
        const pings = await listerPingsEntrants();
        if (annule) return;
        if (pings.length > 0 && !pingEntrantRef.current) {
          setPingEntrant(pings[0]);
        }
      } catch {
        // silencieux — retente au prochain intervalle
      }
    }

    void poll();
    const intervalId = setInterval(poll, 5000);

    // Rattrapage au foreground : si l'utilisateur déverrouille son
    // téléphone après avoir raté un ping, on relance immédiatement
    // sans attendre les 5 s.
    const abonnement = AppState.addEventListener("change", (etat: AppStateStatus) => {
      if (etat === "active") void poll();
    });

    return () => {
      annule = true;
      clearInterval(intervalId);
      abonnement.remove();
    };
  }, []);

  return (
    <PingRecuModal
      ping={pingEntrant}
      onRepondu={() => setPingEntrant(null)}
      onFerme={() => setPingEntrant(null)}
    />
  );
}
