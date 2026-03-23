# Commandes APK et OTA - frontend-mobile

Ce document explique les commandes utiles pour build Android APK, publier des OTA (Expo Updates), tester, et comprendre exactement la portee des OTA.

## 1. Prerequis

- Node.js installe
- Dependances installees (`npm install`)
- EAS CLI disponible via `npx eas`
- Compte Expo connecte (`npx eas whoami`)
- Projet lie a EAS (deja fait dans ce repo)

Verification rapide:

```bash
npx eas --version
npx eas whoami
```

## 2. Commandes du projet

Depuis le dossier `frontend-mobile`:

```bash
npm start
npm run android
npm run build:apk
npm run update:preview
npm run update:production
```

Detail:

- `npm start`: lance Expo en local
- `npm run android`: ouvre l'app sur Android via Expo dev
- `npm run build:apk`: build APK Android interne avec le profil `preview`
- `npm run update:preview`: publie un OTA sur le channel `preview`
- `npm run update:production`: publie un OTA sur le channel `production`

## 3. Build APK (Android)

### Build APK de test interne

```bash
npx eas build --platform android --profile preview
```

Ou via script:

```bash
npm run build:apk
```

Resultat attendu:

- Build visible sur Expo Dashboard
- URL APK telechargeable (Application Archive URL)

Lister les builds:

```bash
npx eas build:list --platform android --limit 5
```

## 4. OTA Update

### Publier un OTA de test (preview)

```bash
npx eas update --channel preview --platform android --message "OTA preview"
```

Ou via script:

```bash
npm run update:preview
```

### Publier un OTA production

```bash
npx eas update --channel production --platform android --message "OTA production"
```

Ou via script:

```bash
npm run update:production
```

Verifier un channel:

```bash
npx eas channel:view preview
npx eas channel:view production
```

## 5. Comment tester OTA correctement

### Procedure recommandee

1. Installer un APK lie au meme channel (ex: `preview`).
2. Ouvrir l'app une premiere fois.
3. Fermer completement l'app.
4. Republier un OTA sur ce meme channel.
5. Rouvrir l'app (avec `checkAutomatically: ON_LOAD`, l'update est recuperee).
6. Fermer puis rouvrir encore une fois pour forcer l'application du bundle mis en cache.

### Test visuel rapide

- Changer une couleur/texte visible
- Publier OTA preview
- Verifier que le changement apparait sans reinstaller l'APK

## 6. Portee reelle des OTA (tres important)

Les OTA Expo mettent a jour:

- Code JavaScript/TypeScript
- Composants React Native
- Assets embarques (images, polices, etc.)
- Logique applicative non-native

Les OTA NE peuvent PAS mettre a jour:

- Code natif Android/iOS
- Nouvelles permissions natives
- Nouvelles libs natives ou changement de plugins Expo
- Changement de configuration native qui impacte le binaire

Dans ces cas, il faut faire un nouveau build (APK/AAB/IPA).

## 7. Regle runtimeVersion

Ton projet utilise:

- `runtimeVersion.policy = appVersion`
- Version actuelle `1.0.0`

Consequence:

- Un OTA est recu seulement par les builds ayant la meme runtimeVersion.
- Si tu changes la version app (ex: `1.0.1`), les anciennes apps `1.0.0` ne recevront pas les OTA `1.0.1`.

## 8. Strategie conseillee (safe)

- `preview`: tests internes / QA
- `production`: utilisateurs finaux

Workflow propre:

1. Publier d'abord sur `preview`
2. Tester sur APK preview
3. Re-publier la meme correction sur `production`

## 9. Rollback rapide OTA

Si une update OTA cause un probleme:

Option simple:

- Republier une version stable precedente sur le meme channel

Exemple:

```bash
npx eas update --channel production --platform android --message "Rollback version stable"
```

Option avancee:

- Utiliser les commandes EAS de republish depuis le dashboard ou CLI selon la version disponible

## 10. Notes utiles pour ce projet

Configuration actuelle:

- `eas.json`:
  - `preview` -> channel `preview`, Android `buildType: apk`
  - `production` -> channel `production`
- `app.json`:
  - `updates.checkAutomatically: ON_LOAD`
  - `updates.fallbackToCacheTimeout: 0`

Implication:

- Les OTA sont verifiees au lancement de l'app
- L'app peut utiliser immediatement le cache si le reseau est lent

## 11. Commandes utiles de diagnostic

```bash
npx eas whoami
npx eas build:list --platform android --limit 5
npx eas channel:view preview
npx eas channel:view production
npx eas update:list --branch preview --limit 5
```

Si une commande n'est pas reconnue, mettre a jour EAS CLI:

```bash
npm install -g eas-cli
```

---

En pratique:

- Bug UI/logique: OTA suffit souvent.
- Bug natif/dependance plugin: nouveau build obligatoire.
