# 📱 MarketHub Mobile - React Native

Application mobile pour MarketHub, marketplace des petites annonces au Niger.

## 🚀 Démarrage Rapide

### 1. **Configuration de l'IP Backend**

Avant de lancer l'app, **IMPORTANT** : Modifiez l'URL de l'API dans `src/utils/constants.js` :

```javascript
// Remplacez par l'IP de votre machine (pas localhost!)
export const API_BASE_URL = 'http://192.168.1.XXX:5000/api';
export const SOCKET_URL = 'http://192.168.1.XXX:5000';
```

**Pour trouver votre IP :**
- Windows : `ipconfig` (cherchez "IPv4")
- Mac/Linux : `ifconfig` ou `ip addr`

### 2. **Installer les dépendances**

```bash
cd frontend-mobile
npm install
```

### 3. **Lancer l'application**

```bash
# Démarrer Expo
npm start

# Ou directement sur un émulateur
npm run android  # Android
npm run ios      # iOS (Mac uniquement)
```

### 4. **Tester sur votre téléphone**

1. Téléchargez **Expo Go** (Play Store / App Store)
2. Scannez le QR code affiché dans le terminal
3. **Assurez-vous que votre téléphone et PC sont sur le même WiFi !**

---

## 📁 Structure du Projet

```
frontend-mobile/
├── App.js                    # Point d'entrée
├── src/
│   ├── screens/             # Écrans de l'app
│   │   ├── LoginScreen.js   ✅ Connexion
│   │   ├── RegisterScreen.js ✅ Inscription
│   │   └── HomeScreen.js    ✅ Écran d'accueil
│   │
│   ├── navigation/          # Navigation
│   │   └── AppNavigator.js  ✅ Gestion auth automatique
│   │
│   ├── contexts/            # State management
│   │   └── AuthContext.js   ✅ Authentification globale
│   │
│   ├── api/                 # Clients API
│   │   └── auth.js          ✅ API auth avec tokens
│   │
│   └── utils/               # Utilitaires
│       ├── constants.js     ✅ Config (API URL, couleurs, catégories)
│       └── storage.js       ✅ Stockage sécurisé (tokens)
```

---

## ✅ Fonctionnalités Actuelles

### **Phase 1 - Base (TERMINÉ)** 
- ✅ Authentification (Login/Register)
- ✅ Stockage sécurisé des tokens (expo-secure-store)
- ✅ Client API avec refresh token automatique
- ✅ Navigation conditionnelle (authentifié ou non)
- ✅ Interface user-friendly avec validations

---

## 🔜 Prochaines Étapes **Phase 2 - Liste des Annonces**
- [ ] Écran liste des produits (avec pagination)
- [ ] Filtres par catégorie
- [ ] Barre de recherche
- [ ] Détail d'une annonce

**Phase 3 - Interaction**
- [ ] Système de favoris
- [ ] Messagerie temps réel (Socket.IO)
- [ ] Envoi de messages

**Phase 4 - Création**
- [ ] Publier une annonce (avec photos)
- [ ] Gérer mes annonces

**Phase 5 - Social**
- [ ] Système d'avis/reviews
- [ ] Profil vendeur

---

## 🔧 Technologies Utilisées

- **React Native** (Expo)
- **React Navigation** (Stack + Tabs)
- **Axios** (API client)
- **Socket.IO Client** (temps réel)
- **Expo Secure Store** (stockage sécurisé)
- **Expo Image Picker** (photos)
- **Expo AV** (messages vocaux)

---

## 🐛 Troubleshooting

### **Erreur de connexion à l'API**
```
Network Error / Request failed
```
**Solutions :**
1. Vérifiez que le backend est lancé (`cd backend && npm run dev`)
2. Vérifiez l'IP dans `constants.js` (pas localhost!)
3. Désactivez temporairement le firewall
4. Assurez-vous d'être sur le même WiFi (téléphone + PC)

### **Expo ne démarre pas**
```bash
# Nettoyer le cache
npm start -- --clear
```

### **Problème d'imports**
```bash
# Réinstaller les dépendances
rm -rf node_modules
npm install
```

---

## 📱 Commandes Utiles

```bash
# Démarrer l'app
npm start

# Démarrer avec cache vidé
npm start -- --clear

# Lancer sur Android
npm run android

# Lancer sur iOS (Mac uniquement)
npm run ios

# Lancer sur Web (bonus)
npm run web
```

---

## 🎨 Guide de Style

### **Couleurs**
- **Primary (Orange)** : `#ec5a13` - Boutons principaux
- **Success (Vert)** : `#10b981` - Messages de succès
- **Error (Rouge)** : `#ef4444` - Erreurs
- **Gray** : Différentes nuances pour textes et backgrounds

### **Espacements**
- **padding** : 20px (écrans)
- **margin** : 16px (éléments)
- **borderRadius** : 8px (boutons, inputs)

### **Typographie**
- **Titres** : 24-28px, bold
- **Sous-titres** : 16-18px, semibold
- **Corps** : 14-16px, regular

---

## 🤝 Contribution

Pour ajouter une nouvelle fonctionnalité :

1. Créer l'écran dans `src/screens/`
2. Ajouter la route dans `AppNavigator.js`
3. Créer le client API si nécessaire dans `src/api/`
4. Tester sur émulateur et device réel

---

## 📞 Support

En cas de problème :
1. Vérifier les logs dans le terminal Expo
2. Vérifier les logs du backend
3. Consulter la documentation Expo : https://docs.expo.dev/

---

**✅ L'application est prête à être lancée et testée !** 🚀
