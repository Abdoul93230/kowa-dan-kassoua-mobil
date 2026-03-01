# ⚡ Démarrage Rapide - 5 Minutes

## 🔥 Lancer l'App Mobile EN 3 ÉTAPES

### **ÉTAPE 1 : Configurer l'IP du Backend** (2 minutes)

1. **Trouver votre IP locale** :
   ```bash
   # Windows PowerShell
   ipconfig
   # Cherchez "Adresse IPv4" (ex: 192.168.1.100)
   ```

2. **Modifier `src/utils/constants.js`** :
   ```javascript
   // Ligne 5-6 : REMPLACER par VOTRE IP
   export const API_BASE_URL = 'http://VOTRE_IP_ICI:5000/api';
   export const SOCKET_URL = 'http://VOTRE_IP_ICI:5000';
   
   // Exemple:
   export const API_BASE_URL = 'http://192.168.1.100:5000/api';
   export const SOCKET_URL = 'http://192.168.1.100:5000';
   ```

---

### **ÉTAPE 2 : Démarrer le Backend** (1 minute)

```bash
# Dans un terminal séparé
cd backend
npm run dev

# ✅ Doit afficher : "Serveur démarré sur port 5000"
```

---

### **ÉTAPE 3 : Lancer l'App Mobile** (2 minutes)

```bash
cd frontend-mobile
npm start
```

**Un QR code apparaît dans le terminal !**

---

## 📱 Tester sur Votre Téléphone

1. **Télécharger Expo Go** :
   - 📱 **Android** : [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - 🍎 **iOS** : [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Scanner le QR code** :
   - Android : Ouvrir Expo Go → Scanner
   - iOS : Ouvrir Appareil Photo → Scanner

3. **Important** : Téléphone et PC doivent être sur le **MÊME WiFi** ! ⚠️

---

## ✅ Tester l'Authentification

### **Créer un compte :**
- Nom : John Doe
- Téléphone : +227 90 00 00 00
- Mot de passe : 123456

### **Se connecter :**
- Téléphone : +227 90 00 00 00
- Mot de passe : 123456

✅ **Si vous voyez l'écran "Bienvenue, John Doe!" → Tout fonctionne !** 🎉

---

## 🐛 Problèmes ?

### **"Network Error" / "API inaccessible"**
1. Vérifiez que le backend tourne (`http://VOTRE_IP:5000/api/health` dans un navigateur)
2. Vérifiez l'IP dans `constants.js`
3. Même WiFi téléphone + PC
4. Firewall Windows/Mac peut bloquer → Désactiver temporairement

### **"Unable to resolve module"**
```bash
npm start -- --clear
```

### **L'app ne se met pas à jour**
```bash
# Shake le téléphone → Reload
# Ou : r dans le terminal Expo
```

---

## 🎯 Prochaine Étape

Une fois que l'authentification fonctionne, on peut **implémenter la liste des annonces** !

Dis-moi quand c'est prêt ! 🚀
