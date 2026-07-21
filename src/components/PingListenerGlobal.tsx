import { useCallback, useEffect, useRef, useState } from "react";
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
 * Doctrine « Décider plus tard » : quand l'utilisateur reporte un
 * ping, on garde son id dans un Set mémoire (`pingsReportes`) pour
 * ne pas le ré-afficher toutes les 5 s pendant sa fenêtre de validité
 * (5 min par défaut côté serveur). Le report est perdu au reload de
 * l'app — le ping resurgira au prochain lancement s'il est encore en
 * attente, ce qui est cohérent (une notification manquée doit revenir).
 *
 * En V0 Expo Go, c'est le fallback aux vraies push notifications
 * distantes (bloquées sans dev-client + Apple Developer).
 */
export function PingListenerGlobal() {
  const [pingEntrant, setPingEntrant] = useState<Ping | null>(null);
  const pingEntrantRef = useRef<Ping | null>(null);
  pingEntrantRef.current = pingEntrant;

  // Ids des pings que l'utilisateur a explicitement reportés durant
  // cette session — on ne les affiche plus tant qu'ils sont en_attente.
  const pingsReportesRef = useRef<Set<string>>(new Set());

  const surRepondu = useCallback(() => {
    // Le ping vient d'être confirmé ou refusé côté serveur : il ne
    // sortira plus des prochains polls (statut != en_attente), pas
    // besoin de le mémoriser localement.
    setPingEntrant(null);
  }, []);

  const surFerme = useCallback(() => {
    // « Décider plus tard » — on mémorise pour éviter la boucle
    // d'affichage tant que le ping reste en_attente.
    if (pingEntrantRef.current) {
      pingsReportesRef.current.add(pingEntrantRef.current.id);
    }
    setPingEntrant(null);
  }, []);

  useEffect(() => {
    let annule = false;

    async function poll() {
      try {
        const pings = await listerPingsEntrants();
        if (annule) return;
        if (pingEntrantRef.current) return;
        const suivant = pings.find((p) => !pingsReportesRef.current.has(p.id));
        if (suivant) setPingEntrant(suivant);
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
    <PingRecuModal ping={pingEntrant} onRepondu={surRepondu} onFerme={surFerme} />
  );
}
