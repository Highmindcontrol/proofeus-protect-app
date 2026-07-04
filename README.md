# Proofeus Protect

Application biométrique multimodale de preuve d'humanité. Version 0.1.0 — scaffold initial.

## Doctrine technique

Cette V1 s'appuie sur le hardware sécurisé de l'appareil (Secure Enclave iOS, Titan M / Android Keystore) pour la couche biométrique de base, complétée par des captures multi-modales (voix, iris, paume, morphologie 3D, détection du vivant) via les APIs Expo natives et TensorFlow Lite pour les modèles embarqués.

Précisions attendues par modalité :

- Morphologie faciale 3D : **99,9 %** (Face ID / ARCore)
- Détection du vivant : **~95 %** combiné (pouls PPG + défis aléatoires + accéléromètre)
- Voix + challenge vocal : **92-96 %**
- Iris (caméra RGB) : **70-90 %** selon couleur d'œil
- Paume (géométrie + lignes) : **85-90 %**
- **Fusion multi-modale : > 99,5 %**

Doctrine complète et engagement d'évolution documentés publiquement sur [proofeus.com/engagement](https://proofeus.com/engagement).

## Stack

- **Framework** : Expo SDK 52 + Expo Router 4 + React Native 0.76 (new architecture)
- **Langage** : TypeScript strict
- **State** : React hooks + Zustand (à venir)
- **Biométrie device** : `expo-local-authentication`
- **Caméra** : `expo-camera`
- **Storage sécurisé** : `expo-secure-store` (Keychain iOS / EncryptedSharedPreferences Android)
- **Backend** : Supabase (partagé avec proofeus.com et watch.proofeus.com)
- **Icônes / SVG** : `react-native-svg`
- **Animations** : `react-native-reanimated`

## Démarrer en local

Prérequis : Node.js 20+, npm ou pnpm, Expo Go installé sur votre iPhone/Android.

```bash
# Installer les dépendances
npm install

# Configurer l'environnement local
cp .env.example .env
# Puis remplir EXPO_PUBLIC_SUPABASE_ANON_KEY

# Lancer le serveur Expo
npm start

# → Scannez le QR code avec Expo Go (Android) ou l'appareil photo (iOS)
```

## Structure

```
proofeus-protect-app/
├── app/                    Screens Expo Router
│   ├── _layout.tsx         Layout racine + Stack navigation
│   ├── index.tsx           Écran d'accueil
│   └── biometric-test.tsx  Test biométrique device (V0)
├── src/
│   ├── theme/              Palette + typographie
│   ├── biometrics/         Interfaces avec les APIs biométriques
│   ├── supabase/           Client Supabase
│   ├── crypto/             Signature de jetons (à venir)
│   └── components/         Composants partagés
└── assets/                 Icônes et splash screens
```

## Roadmap V1 (5-6 mois)

| Sprint | Livrable |
|---|---|
| 1-2 | ✅ Setup Expo + Supabase + écran accueil + test biométrique device |
| 3-4 | Flow d'onboarding : voix + challenge vocal |
| 5-6 | Iris + morphologie 3D via caméra frontale |
| 7-8 | Paume (géométrie) + fusion multi-modale + scoring |
| 9-10 | QR code éphémère signé + page vérification web |
| 11-12 | Sécurité+ : géolocalisation, bouton d'alerte, codes sécurité/danger |
| 13-14 | KYC artisanal (scan pièce + face match ML Kit) |
| 15-16 | Polish UX + tests TestFlight + dépôt App Store / Play Store |

## Comptes plateformes à ouvrir

Avant qu'on puisse déposer sur les stores, il faut :

- [ ] **Apple Developer Program** — 99 $/an, compte Organization, DUNS number
- [ ] **Google Play Console** — 25 $ one-shot, compte Organization
- [ ] **Politique de confidentialité** : ✅ publiée sur [proofeus.com/confidentialite](https://proofeus.com/confidentialite)
- [ ] **Mentions légales** : ✅ publiées sur [proofeus.com/mentions-legales](https://proofeus.com/mentions-legales)
- [ ] **Notre engagement** : ✅ publié sur [proofeus.com/engagement](https://proofeus.com/engagement)

Détails : voir la conversation d'origine du 4 juillet 2026.

## Contact

- Contact général : contact@proofeus.com
- Sécurité / vulnérabilités : security@proofeus.com
- Données personnelles : dpo@proofeus.com

© 2026 Proofeus® — Une marque du groupe Ataraxis, verticale Ataraxis IA.
