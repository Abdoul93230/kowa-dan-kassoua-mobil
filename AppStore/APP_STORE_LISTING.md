# 🍎 App Store Connect — Contenu prêt à copier-coller

App : **TakTak** (com.kowadankassoua.mobile) — vérifié le 08/10/2026.
Toutes les limites de caractères sont respectées (✔).

---

## 1. Header Asset (visuel d'en-tête)

Tailles acceptées : **5244 × 2950 px** ou **3840 × 1646 px** (paysage).

Création rapide (Canva → modèle "App Store Header" ou un canvas aux bons pixels) :
- Fond : dégradé orange `#ec5a13` → `#d44f11` (ou photo marché chaleureuse avec voile orange)
- Logo : `Branding/flogo-removebg-preview.png` ou `Branding/logo10-removebg-preview.png`
- Accroche courte (ex.) : **« Achetez et vendez facilement, partout au Niger »**
- Baseline : « Marketplace 100% gratuite — Annonces, messagerie, négociation »

> ⚠️ Aucun texte important dans les ~15% des bords (risk de crop selon le device).
> L'asset n'est **pas** indexé en recherche — il sert à l'aspect visuel du produit.

---

## 2. Promotional Text (170 caractères max)

**167/170 ✔** — Texte promotionnel :

```
Vendez et achetez facilement au Niger ! Annonces 100% gratuites, messagerie instantanée et contact direct entre acheteurs et vendeurs. Rejoignez la communauté TakTak !
```

> Ce champ est modifiable **à tout moment sans nouvelle revue** (contrairement à la description). Idéal pour annonces promotionnelles.

---

## 3. Description (4000 caractères max)

**2512/4000 ✔** :

```
TakTak (Kowa Dan Kassoua) est la marketplace 100% gratuite qui connecte vendeurs, acheteurs et prestataires de services au Niger. Trouvez tout près de chez vous : téléphone, voiture, immobilier, alimentation, mode, maison, emploi, services et bien plus.

POURQUOI TAKTAK ?

✅ 100% GRATUIT
Publier vos annonces est entièrement gratuit, sans frais cachés ni commission. Achetez et vendez en toute liberté.

📍 TROUVEZ TOUT PRÈS DE CHEZ VOUS
Parcourez des milliers d'annonces dans votre quartier et dans tout le Niger. Filtrez par catégorie, prix et localisation pour dénicher les meilleures offres près de chez vous.

📸 PUBLIEZ EN QUELQUES SECONDES
Ajoutez jusqu'à 5 photos, décrivez votre produit ou service, fixez votre prix et publiez. Votre annonce devient visible par des milliers d'acheteurs potentiels.

💬 MESSAGERIE TEMPS RÉEL
Discutez directement avec les vendeurs et acheteurs grâce à la messagerie instantanée. Envoyez des messages texte ou vocaux, négociez le prix et concluez en toute confiance. Voyez en temps réel quand votre interlocuteur est en ligne.

🤝 NÉGOCIATION SÉCURISÉE
Proposez votre prix, acceptez ou refusez les offres directement dans la conversation. Suivez clairement l'état de chaque affaire en cours.

❤️ FAVORIS
Sauvegardez vos coups de cœur et retrouvez-les à tout moment, même hors connexion.

⭐ AVIS ET PROFILS VÉRIFIÉS
Consultez les avis, les notes et les statistiques des vendeurs avant d'acheter. Contactez-les en un clic en toute confiance.

🔔 NOTIFICATIONS INTELLIGENTES
Recevez une notification dès qu'un message arrive, qu'une offre est faite sur votre annonce ou qu'un vendeur vous répond.

📱 INSCRIPTION EN 30 SECONDES
Créez un compte gratuitement avec votre numéro de téléphone, validez le code OTP reçu par SMS et commencez immédiatement. Connexion sécurisée par mot de passe ou connexion rapide.

COMMENT ÇA MARCHE ?
1. Publiez : ajoutez vos photos et décrivez votre annonce.
2. Discutez : échangez directement par messagerie.
3. Rencontrez : convenez d'un lieu et concluez entre vous.

CE QUE VOUS TROUVEREZ SUR TAKTAK :
Téléphones et ordinateurs, voitures et motos, meubles et électroménager, vêtements et beauté, aliments frais, terrains et appartements à louer, services de réparation, cours particuliers, emploi et bien plus encore.

Que vous soyez vendeur, acheteur ou prestataire de services, TakTak est l'application idéale pour acheter et vendre au Niger.

Téléchargez TakTak gratuitement et rejoignez la communauté des vendeurs et acheteurs du Niger !
```

---

## 4. Keywords (100 caractères max)

**95/100 ✔** :

```
annonces,marketplace,niger,vente,achat,immobilier,voiture,emploi,services,occasion,publier,chat
```

> Règles : pas d'espace après la virgule (l'espace compte), ne pas répéter "TakTak" (déjà dans le titre), chaque mot-clé est indexé sauf le nom de l'app.

Variante orientée recherches locales (**99/100 ✔**) :

```
petites annonces,seconde main,niger,vente,achat,immobilier,emploi,services,voiture,achat en ligne
```

---

## 5. Support URL

```
https://taktak-ne.com/centre-aide
```

> ⚠️ Le site renvoyait une erreur 503 au moment de la rédaction. **Apple vérifie que cette URL répond** pendant la revue — assurez-vous que le site est en ligne et stable avant de soumettre.

---

## 6. Marketing URL (optionnelle mais recommandée)

```
https://taktak-ne.com
```

---

## 7. Version

```
1.0
```

> Correspond à `"version": "1.0.0"` dans `app.json`. C'est le **CFBundleShortVersionString** de votre build — le numéro de build (versionCode 3) est géré séparément dans App Store Connect.

---

## 8. Copyright (200 caractères max)

```
© 2026 SmartLimb
```

> Doit correspondre au nom légal déclaré dans votre compte App Store Connect (SmartLimb ou votre nom si compte individuel).

---

## ✅ Checklist avant soumission

- [ ] Site `taktak-ne.com` en ligne (Support + Marketing URL testées par Apple)
- [ ] Politique de confidentialité accessible (`https://taktak-ne.com/confidentialite`)
- [ ] Questions App Privacy remplies (l'app collecte : email/téléphone, photo, ID d'appareil push, données d'usage)
- [ ] Screenshots iPhone 6.9" (1320×2868) et 6.5" (1290×2796) — le dossier `Branding/` contient des captures d'écran
- [ ] Démo/vidéo si demandée (compte avec données de test accessible)
- [ ] Aucun appel à une API non publique en prod (`api.taktak-ne.com` actif)
