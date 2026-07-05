import { useEffect } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

/**
 * Écoute les deep links entrants (proofeus://) et route en conséquence.
 *
 * URLs gérées :
 *  - proofeus://auth/confirmed  → écran de connexion, message de succès
 *  - proofeus://auth/recovery   → écran de réinitialisation (à venir)
 *
 * Le scheme "proofeus" est déclaré dans app.json (scheme: "proofeus").
 */
export function useDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    function handleUrl(url: string) {
      const parsed = Linking.parse(url);
      // parsed.hostname = "auth", parsed.path = "confirmed"
      // ou parsed.path = "auth/confirmed" selon iOS/Android
      const target = [parsed.hostname, parsed.path]
        .filter(Boolean)
        .join("/")
        .replace(/^\/+|\/+$/g, "");

      if (target === "auth/confirmed" || target === "auth/confirmed/") {
        router.replace({
          pathname: "/login",
          params: { confirmed: "1" },
        });
      }
    }

    // Cas 1 : app fermée → ouverte par un deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Cas 2 : app déjà ouverte → événement d'URL entrant
    const subscription = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [router]);
}
