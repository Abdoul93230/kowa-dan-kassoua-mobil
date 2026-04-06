// ─── ProfileScreen v3 ─ MarketHub Niger ──────────────────────────────────────
// Utilise CustomBottomSheet v2 : footer={} toujours visible, scroll flex:1

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, StatusBar, Image, Animated,
  ActivityIndicator, TextInput, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';
import AlertModal from '../components/AlertModal';
import CustomBottomSheet from '../components/CustomBottomSheet';
import { updateProfile } from '../api/auth';

const NIGER_CITIES = [
  'Niamey', 'Zinder', 'Maradi', 'Agadez', 'Tahoua',
  'Dosso', 'Diffa', 'Tillabéri', 'Birni-N\'Konni', 'Arlit',
  'Gaya', 'Tessaoua',
];

const COUNTRIES = [
  { code: 'NE', name: 'Niger',         dialCode: '+227', flag: '🇳🇪' },
  { code: 'SN', name: 'Sénégal',       dialCode: '+221', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225', flag: '🇨🇮' },
  { code: 'BF', name: 'Burkina Faso',  dialCode: '+226', flag: '🇧🇫' },
  { code: 'ML', name: 'Mali',          dialCode: '+223', flag: '🇲🇱' },
  { code: 'TG', name: 'Togo',          dialCode: '+228', flag: '🇹🇬' },
  { code: 'BJ', name: 'Bénin',         dialCode: '+229', flag: '🇧🇯' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { user, isAuthenticated, logout, updateUserProfile } = useAuth();
  const { isDark, theme, themePreference, setThemePreference } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [alert, setAlert] = useState({
    visible: false, type: 'info', title: '', message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  // Sheets visibility
  const [editSheet,     setEditSheet]     = useState(false);
  const [securitySheet, setSecuritySheet] = useState(false);
  const [citySheet,     setCitySheet]     = useState(false);
  const [countrySheet,  setCountrySheet]  = useState(false);
  const [themeSheet,    setThemeSheet]    = useState(false);

  // Loaders
  const [loggingOut,       setLoggingOut]       = useState(false);
  const [savingProfile,    setSavingProfile]    = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Edit profile fields
  const [editName,         setEditName]         = useState('');
  const [editCity,         setEditCity]         = useState('');
  const [editAvatarUri,    setEditAvatarUri]    = useState(null);
  const [editEmail,        setEditEmail]        = useState('');
  const [editWhatsapp,     setEditWhatsapp]     = useState('');
  const [editDescription,  setEditDescription]  = useState('');
  const [editBusinessType, setEditBusinessType] = useState('individual');
  const [editBusinessName, setEditBusinessName] = useState('');
  const [whatsappCountry,  setWhatsappCountry]  = useState(COUNTRIES[0]);

  // Security fields
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!user) return;
    setEditName(user.name || '');
    setEditCity(user.city || user.location || '');
    setEditAvatarUri(user.avatar || null);
    setEditEmail(user.email || '');
    setEditDescription(user.description || '');
    setEditBusinessType(user.businessType || 'individual');
    setEditBusinessName(user.businessName || '');
    const raw = user?.contactInfo?.whatsapp || '';
    if (raw) {
      const m = COUNTRIES.find(c => raw.startsWith(c.dialCode));
      if (m) { setWhatsappCountry(m); setEditWhatsapp(raw.replace(m.dialCode, '').trim()); }
      else    { setEditWhatsapp(raw); }
    }
  }, [user]);

  const showAlert = (type, title, message, buttons) =>
    setAlert({ visible: true, type, title, message, buttons: buttons || [{ text: 'OK', onPress: () => {} }] });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleLogout = () => {
    showAlert('warning', 'Se déconnecter', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', onPress: () => {} },
      { text: 'Déconnecter', onPress: async () => {
        setAlert(a => ({ ...a, visible: false }));
        setLoggingOut(true);
        try { await logout(); navigation.navigate('Home'); }
        catch (e) { setLoggingOut(false); showAlert('error', 'Erreur', e.message); }
      }},
    ]);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) { showAlert('error', 'Erreur', 'Le nom est requis'); return; }
    setSavingProfile(true);
    try {
      const fullWA = editWhatsapp.trim() ? `${whatsappCountry.dialCode} ${editWhatsapp.trim()}` : undefined;
      const data = {
        name: editName.trim(), city: editCity.trim(),
        avatar: editAvatarUri || null, email: editEmail.trim() || undefined,
        description: editDescription.trim() || undefined,
        businessType: editBusinessType, whatsapp: fullWA,
        ...(editBusinessType === 'professional' ? { businessName: editBusinessName.trim() || undefined } : {}),
      };
      const res = await updateProfile(data);
      if (res.success) {
        await updateUserProfile(res?.data?.user || {});
        setEditSheet(false);
        showAlert('success', 'Profil mis à jour', 'Informations sauvegardées avec succès !');
      }
    } catch (e) {
      showAlert('error', 'Erreur', e.message || 'Impossible de mettre à jour le profil');
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!newPwd || newPwd.length < 6) { showAlert('error', 'Erreur', 'Minimum 6 caractères requis'); return; }
    if (newPwd !== confirmPwd)         { showAlert('error', 'Erreur', 'Les mots de passe ne correspondent pas'); return; }
    if (!user?.needsPasswordChange && !currentPwd) { showAlert('error', 'Erreur', 'Entrez votre mot de passe actuel'); return; }
    setChangingPassword(true);
    try {
      const { changePassword } = require('../api/auth');
      const res = await changePassword({ currentPassword: currentPwd, newPassword: newPwd });
      if (res.success) {
        setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
        await updateUserProfile({ needsPasswordChange: false });
        setSecuritySheet(false);
        showAlert('success', 'Succès', 'Mot de passe mis à jour avec succès');
      } else throw new Error(res.message);
    } catch (e) {
      showAlert('error', 'Erreur', e.message || 'Impossible de changer le mot de passe');
    } finally { setChangingPassword(false); }
  };

  const handleSelectImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') { showAlert('error', 'Permission refusée', 'Autorisez l\'accès à vos photos'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.65, base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const p = res.assets[0];
        setEditAvatarUri(p.base64 ? `data:image/jpeg;base64,${p.base64}` : p.uri);
      }
    } catch { showAlert('error', 'Erreur', 'Impossible de sélectionner l\'image'); }
  };

  const getInitials = () => {
    if (!user?.name) return '?';
    const n = user.name.split(' ');
    return n.length >= 2 ? (n[0][0] + n[n.length - 1][0]).toUpperCase() : user.name.substring(0, 2).toUpperCase();
  };

  // ── Calcul force MDP ─────────────────────────────────────────────────────
  const pwdStrength = newPwd.length === 0 ? 0 : newPwd.length < 6 ? 1 : newPwd.length < 10 ? 2 : newPwd.length < 14 ? 3 : 4;
  const pwdLabel    = ['', 'Trop court', 'Moyen', 'Fort', 'Très fort'][pwdStrength];
  const pwdColor    = ['', P.error, P.orange500, P.greenDark, '#1a9e75'][pwdStrength];

  // ─────────────────────────────────────────────────────────────────────────
  // NON-AUTH
  // ─────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={[s.container, { backgroundColor: theme.screen }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={isDark ? [P.brown, P.charcoal] : theme.header} style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}>
          <View style={s.headerAccent} />
          <Text style={[s.headerTitle, { color: isDark ? P.white : theme.text }]}>Profil</Text>
        </LinearGradient>
        <ScrollView style={s.content}>
          <View style={s.notAuthBox}>
            <Text style={s.notAuthEmoji}>👤</Text>
            <Text style={s.notAuthTitle}>Connectez-vous à votre compte</Text>
            <Text style={s.notAuthText}>Accédez à vos annonces, favoris, messages et bien plus</Text>
            <View style={{ width: '100%', gap: 12 }}>
              <TouchableOpacity style={s.loginBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.88}>
                <LinearGradient colors={[P.terra, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.loginBtnGrad}>
                  <Text style={s.loginBtnTxt}>Se connecter</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={s.registerBtn} onPress={() => navigation.navigate('Register')} activeOpacity={0.88}>
                <Text style={s.registerBtnTxt}>Créer un compte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: theme.screen }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Bannière MDP */}
      {user?.needsPasswordChange && (
        <View style={[s.pwdBanner, { paddingTop: (insets.top || 0) + 12 }]}>
          <Text style={s.pwdBannerTxt}>🔒 Personnalisez votre mot de passe pour sécuriser votre compte.</Text>
          <TouchableOpacity onPress={() => setSecuritySheet(true)} style={s.pwdBannerBtn}>
            <Text style={s.pwdBannerBtnTxt}>Mettre à jour</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header gradient */}
      <LinearGradient colors={isDark ? [P.brown, P.charcoal] : theme.header} style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}>
        <View style={s.headerAccent} />
        <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [-10, 0] }) }] }}>
          <Text style={[s.headerTitle, { color: isDark ? P.white : theme.text }]}>Mon Profil</Text>
        </Animated.View>
      </LinearGradient>

      {/* Main scroll */}
      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: Math.max(insets.bottom, 12) + 100 }]} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <Animated.View style={[s.profileCard, { opacity: headerAnim, transform: [{ scale: headerAnim.interpolate({ inputRange: [0,1], outputRange: [0.9, 1] }) }] }]}>
          <BlurView intensity={80} style={s.blurWrapper}>
            <View style={s.avatarSection}>
              <View style={s.avatarWrap}>
                {user?.avatar
                  ? <Image source={{ uri: user.avatar }} style={s.avatarImg} />
                  : <View style={[s.avatarImg, s.avatarFallback]}><Text style={s.avatarInitials}>{getInitials()}</Text></View>
                }
                <TouchableOpacity style={s.avatarEdit} onPress={() => setEditSheet(true)} activeOpacity={0.75}>
                  <Text style={{ fontSize: 15 }}>✏️</Text>
                </TouchableOpacity>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={s.userName}>{user?.name || 'Utilisateur'}</Text>
                <Text style={s.userEmail}>{user?.email || ''}</Text>
                <View style={s.badge}><Text style={s.badgeTxt}>✓ Compte vérifié</Text></View>
              </View>
            </View>

            {/* Infos + bouton éditer */}
            <View style={s.infoSection}>
              <View style={s.infoSectionHead}>
                <Text style={s.sectionLabel}>Détails du compte</Text>
                <TouchableOpacity onPress={() => setEditSheet(true)} style={s.editChip} activeOpacity={0.7}>
                  <Text style={s.editChipIcon}>✏️</Text>
                  <Text style={s.editChipTxt}>Éditer</Text>
                </TouchableOpacity>
              </View>
              {user?.phone && <InfoRow icon="📞" label="Téléphone" value={user.phone} />}
              {(user?.city || user?.location) && <InfoRow icon="📍" label="Ville" value={user?.city || user?.location} />}
              {user?.accountType && <InfoRow icon="🏢" label="Type de compte" value={user.accountType === 'business' ? 'Professionnel' : 'Personnel'} />}
            </View>
          </BlurView>
        </Animated.View>

        {/* Menu items */}
        <View style={s.menuSection}>
          <MenuItem icon="🔐" label="Sécurité et Connexion" onPress={() => setSecuritySheet(true)} />
          <MenuItem icon="🌗" label={`Apparence : ${themePreference === 'system' ? 'Système' : themePreference === 'dark' ? 'Sombre' : 'Clair'}`} onPress={() => setThemeSheet(true)} />
          <MenuItem icon="📦" label="Mes annonces"          onPress={() => navigation.navigate('MyListings')} />
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} disabled={loggingOut} activeOpacity={0.85}>
          <View style={s.logoutAccent} />
          <View style={s.logoutRow}>
            {loggingOut ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10 }}>
                <ActivityIndicator color={P.error} size="small" />
                <Text style={s.logoutTxt}>Déconnexion...</Text>
              </View>
            ) : (
              <>
                <View style={s.logoutIconWrap}><Text style={{ fontSize: 17, color: P.error }}>⎋</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.logoutTxt}>Se déconnecter</Text>
                  <Text style={s.logoutHint}>Fermer votre session sur cet appareil</Text>
                </View>
                <Text style={{ fontSize: 22, color: P.error }}>›</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

      </ScrollView>

      {/* Alert */}
      <AlertModal
        visible={alert.visible} type={alert.type}
        title={alert.title} message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert(a => ({ ...a, visible: false }))}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SHEET : ÉDITER LE PROFIL                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CustomBottomSheet
        visible={themeSheet}
        onClose={() => setThemeSheet(false)}
        title="Apparence"
        avoidKeyboard={false}
      >
        <Text style={{ fontSize: 14, color: theme.textMuted, marginBottom: 16, lineHeight: 20 }}>
          Choisissez le mode d'affichage de l'app. Le mode système suit automatiquement le réglage du téléphone.
        </Text>

        {[
          { value: 'system', label: 'Système', icon: '📱' },
          { value: 'light', label: 'Clair', icon: '☀️' },
          { value: 'dark', label: 'Sombre', icon: '🌙' },
        ].map((option) => {
          const active = themePreference === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[
                s.themeOption,
                active && s.themeOptionActive,
                active && { borderColor: P.terra, backgroundColor: P.peachSoft },
              ]}
              onPress={() => setThemePreference(option.value)}
              activeOpacity={0.8}
            >
              <Text style={s.themeOptionIcon}>{option.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.themeOptionLabel, active && { color: P.terra }]}>{option.label}</Text>
                <Text style={s.themeOptionSub}>
                  {option.value === 'system' && 'Suit automatiquement le thème du téléphone'}
                  {option.value === 'light' && 'Interface claire et lumineuse'}
                  {option.value === 'dark' && 'Interface sombre et contrastée'}
                </Text>
              </View>
              {active && <Text style={{ fontSize: 18, color: P.terra }}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </CustomBottomSheet>

      <CustomBottomSheet
        visible={editSheet}
        onClose={() => setEditSheet(false)}
        title="Éditer le profil"
        avoidKeyboard
        footer={
          <TouchableOpacity
            style={[s.actionBtn, savingProfile && s.actionBtnDisabled]}
            onPress={handleSaveProfile}
            disabled={savingProfile}
            activeOpacity={0.88}
          >
            <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.actionBtnGrad}>
              {savingProfile
                ? <ActivityIndicator color={P.white} />
                : (
                  <View style={s.actionBtnContent}>
                    <Text style={s.actionBtnIcon}>💾</Text>
                    <Text style={s.actionBtnTxt}>Enregistrer les modifications</Text>
                  </View>
                )}
            </LinearGradient>
          </TouchableOpacity>
        }
      >
        {/* Photo de profil */}
        <FieldGroup label="Photo de profil">
          <TouchableOpacity style={s.avatarPickerWrap} onPress={handleSelectImage} disabled={savingProfile} activeOpacity={0.8}>
            {editAvatarUri
              ? <Image source={{ uri: editAvatarUri }} style={s.avatarPickerImg} />
              : <View style={[s.avatarPickerImg, s.avatarPickerFallback]}><Text style={{ fontSize: 52 }}>📷</Text></View>}
            <View style={s.avatarPickerOverlay}>
              <Text style={s.avatarPickerOverlayTxt}>✏️  Changer la photo</Text>
            </View>
          </TouchableOpacity>
        </FieldGroup>

        {/* Nom */}
        <FieldGroup label="Nom complet">
          <TextInput style={s.input} placeholder="Votre nom" placeholderTextColor={P.muted}
            value={editName} onChangeText={setEditName} editable={!savingProfile} />
        </FieldGroup>

        {/* Ville */}
        <FieldGroup label="Ville">
          <TouchableOpacity style={s.selectRow} onPress={() => setCitySheet(true)} activeOpacity={0.75}>
            <Text style={s.selectRowIcon}>📍</Text>
            <Text style={[s.selectRowVal, !editCity && { color: P.muted }]}>{editCity || 'Sélectionner une ville'}</Text>
            <Text style={s.selectRowArrow}>›</Text>
          </TouchableOpacity>
        </FieldGroup>

        {/* Email */}
        <FieldGroup label="Adresse email">
          <TextInput style={s.input} placeholder="votre@email.com" placeholderTextColor={P.muted}
            value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" editable={!savingProfile} />
        </FieldGroup>

        {/* WhatsApp */}
        <FieldGroup label="Numéro WhatsApp">
          <View style={s.phoneRow}>
            <TouchableOpacity style={s.dialPill} onPress={() => setCountrySheet(true)} activeOpacity={0.8} disabled={savingProfile}>
              <Text style={{ fontSize: 18 }}>{whatsappCountry.flag}</Text>
              <Text style={s.dialCode}>{whatsappCountry.dialCode}</Text>
              <Text style={s.dialArrow}>▾</Text>
            </TouchableOpacity>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="12 34 56 78" placeholderTextColor={P.muted}
              value={editWhatsapp} onChangeText={setEditWhatsapp} keyboardType="phone-pad" editable={!savingProfile} />
          </View>
        </FieldGroup>

        {/* Type de compte */}
        <FieldGroup label="Type de compte">
          <View style={s.typeRow}>
            {['individual', 'professional'].map(t => (
              <TouchableOpacity
                key={t}
                style={[s.typeBtn, editBusinessType === t && s.typeBtnActive]}
                onPress={() => setEditBusinessType(t)}
              >
                <Text style={[s.typeBtnTxt, editBusinessType === t && s.typeBtnTxtActive]}>
                  {t === 'individual' ? '👤  Particulier' : '🏢  Professionnel'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FieldGroup>

        {/* Nom entreprise */}
        {editBusinessType === 'professional' && (
          <FieldGroup label="Nom de l'entreprise">
            <TextInput style={s.input} placeholder="Nom de votre boutique / entreprise" placeholderTextColor={P.muted}
              value={editBusinessName} onChangeText={setEditBusinessName} editable={!savingProfile} />
          </FieldGroup>
        )}

        {/* Description */}
        <FieldGroup label="Description / Bio">
          <TextInput
            style={[s.input, s.inputMulti]}
            placeholder="Parlez-nous de vous..."
            placeholderTextColor={P.muted}
            value={editDescription}
            onChangeText={setEditDescription}
            multiline numberOfLines={3}
            textAlignVertical="top"
            editable={!savingProfile}
          />
        </FieldGroup>
      </CustomBottomSheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SHEET : SÉCURITÉ                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CustomBottomSheet
        visible={securitySheet}
        onClose={() => { setSecuritySheet(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); }}
        title="Sécurité et Connexion"
        avoidKeyboard
        footer={
          <TouchableOpacity
            style={[s.actionBtn, (!newPwd || !confirmPwd || changingPassword) && s.actionBtnDisabled]}
            onPress={handleChangePassword}
            disabled={changingPassword || !newPwd || !confirmPwd}
            activeOpacity={0.88}
          >
            <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.actionBtnGrad}>
              {changingPassword
                ? <ActivityIndicator color={P.white} />
                : (
                  <View style={s.actionBtnContent}>
                    <Text style={s.actionBtnIcon}>🔐</Text>
                    <Text style={s.actionBtnTxt}>Mettre à jour le mot de passe</Text>
                  </View>
                )}
            </LinearGradient>
          </TouchableOpacity>
        }
      >
        {/* Carte info */}
        <View style={s.secCard}>
          <Text style={{ fontSize: 28, marginRight: 14 }}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.secCardTitle}>Changer le mot de passe</Text>
            <Text style={s.secCardSub}>Utilisez un mot de passe fort et unique pour protéger votre compte.</Text>
          </View>
        </View>

        {/* Mot de passe actuel */}
        {!user?.needsPasswordChange && (
          <FieldGroup label="Mot de passe actuel">
            <TextInput style={s.input} placeholder="Votre mot de passe actuel" placeholderTextColor={P.muted}
              value={currentPwd} onChangeText={setCurrentPwd} secureTextEntry />
          </FieldGroup>
        )}

        {/* Nouveau MDP */}
        <FieldGroup label="Nouveau mot de passe">
          <TextInput style={s.input} placeholder="Minimum 6 caractères" placeholderTextColor={P.muted}
            value={newPwd} onChangeText={setNewPwd} secureTextEntry />
          {/* Indicateur de force */}
          {newPwd.length > 0 && (
            <View style={s.strengthWrap}>
              {[1,2,3,4].map(i => (
                <View key={i} style={[s.strengthBar, { backgroundColor: pwdStrength >= i ? pwdColor : P.sand }]} />
              ))}
              <Text style={[s.strengthLabel, { color: pwdColor }]}>{pwdLabel}</Text>
            </View>
          )}
        </FieldGroup>

        {/* Confirmer MDP */}
        <FieldGroup label="Confirmer le nouveau mot de passe">
          <TextInput style={s.input} placeholder="Répétez le nouveau mot de passe" placeholderTextColor={P.muted}
            value={confirmPwd} onChangeText={setConfirmPwd} secureTextEntry />
          {/* Indicateur correspondance */}
          {confirmPwd.length > 0 && (
            <View style={s.matchRow}>
              <Text style={{ fontSize: 13, color: newPwd === confirmPwd ? P.greenDark : P.error }}>
                {newPwd === confirmPwd ? '✓ Les mots de passe correspondent' : '✗ Les mots de passe ne correspondent pas'}
              </Text>
            </View>
          )}
        </FieldGroup>
      </CustomBottomSheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SHEET : VILLE                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CustomBottomSheet
        visible={citySheet}
        onClose={() => setCitySheet(false)}
        title="Choisir une ville"
        avoidKeyboard={false}
      >
        {NIGER_CITIES.map(city => (
          <TouchableOpacity
            key={city}
            style={[s.listRow, editCity === city && s.listRowActive]}
            onPress={() => { setEditCity(city); setCitySheet(false); }}
            activeOpacity={0.75}
          >
            <Text style={s.listRowIcon}>📍</Text>
            <Text style={[s.listRowTxt, editCity === city && { color: P.terra, fontWeight: '800' }]}>{city}, Niger</Text>
            {editCity === city && <Text style={{ color: P.terra, fontSize: 16, fontWeight: '900' }}>✓</Text>}
          </TouchableOpacity>
        ))}
      </CustomBottomSheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SHEET : PAYS WHATSAPP                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CustomBottomSheet
        visible={countrySheet}
        onClose={() => setCountrySheet(false)}
        title="Indicatif du pays"
        avoidKeyboard={false}
      >
        {COUNTRIES.map(c => (
          <TouchableOpacity
            key={c.code}
            style={[s.listRow, whatsappCountry.code === c.code && s.listRowActive]}
            onPress={() => { setWhatsappCountry(c); setCountrySheet(false); }}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 22, marginRight: 14 }}>{c.flag}</Text>
            <Text style={[s.listRowTxt, whatsappCountry.code === c.code && { color: P.terra, fontWeight: '800' }]}>{c.name}</Text>
            <Text style={s.listRowDial}>{c.dialCode}</Text>
            {whatsappCountry.code === c.code && <Text style={{ color: P.terra, fontSize: 16, fontWeight: '900', marginLeft: 8 }}>✓</Text>}
          </TouchableOpacity>
        ))}
      </CustomBottomSheet>

    </View>
  );
}

// ─── Petits composants locaux ─────────────────────────────────────────────────
function FieldGroup({ label, children }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoRowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.infoRowLabel}>{label}</Text>
        <Text style={s.infoRowValue}>{value}</Text>
      </View>
    </View>
  );
}

function MenuItem({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.75}>
      <Text style={s.menuItemIcon}>{icon}</Text>
      <Text style={s.menuItemLabel}>{label}</Text>
      <Text style={s.menuItemArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.sand },

  header: { paddingHorizontal: 18, paddingBottom: 14, overflow: 'hidden', position: 'relative' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerTitle: { fontSize: 28, fontWeight: '700', color: P.white, marginBottom: 4 },

  pwdBanner: {
    backgroundColor: P.orange100, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: P.orange300,
  },
  pwdBannerTxt: { flex: 1, fontSize: 13, color: P.orange700, fontWeight: '600', marginRight: 10 },
  pwdBannerBtn: { backgroundColor: P.orange600, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pwdBannerBtnTxt: { color: P.white, fontSize: 12, fontWeight: '700' },

  content: { flex: 1 },
  scrollContent: { paddingTop: 18, paddingHorizontal: 12 },

  // Non auth
  notAuthBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  notAuthEmoji: { fontSize: 60, marginBottom: 20 },
  notAuthTitle: { fontSize: 24, fontWeight: '700', color: P.charcoal, marginBottom: 12, textAlign: 'center' },
  notAuthText: { fontSize: 15, color: P.muted, marginBottom: 40, textAlign: 'center', lineHeight: 22 },
  loginBtn: { overflow: 'hidden', borderRadius: 14, elevation: 6 },
  loginBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  loginBtnTxt: { fontSize: 15, fontWeight: '700', color: P.white },
  registerBtn: { paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: P.terra, borderRadius: 14, backgroundColor: P.white },
  registerBtnTxt: { fontSize: 15, fontWeight: '700', color: P.terra },

  // Profile card
  profileCard: { marginHorizontal: 6, marginBottom: 24, borderRadius: 18, overflow: 'hidden' },
  blurWrapper: { borderRadius: 18, overflow: 'hidden', backgroundColor: P.white, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  avatarSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, gap: 14 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: P.terra, backgroundColor: P.sand, alignItems: 'center', justifyContent: 'center' },
  avatarFallback: { backgroundColor: P.orange500 },
  avatarInitials: { fontSize: 42, fontWeight: '800', color: P.white },
  avatarEdit: { position: 'absolute', bottom: -2, right: -2, width: 36, height: 36, borderRadius: 18, backgroundColor: P.terra, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: P.white },
  userName: { fontSize: 20, fontWeight: '800', color: P.charcoal, marginBottom: 2 },
  userEmail: { fontSize: 13, color: P.muted, marginBottom: 10 },
  badge: { backgroundColor: P.successSoft, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: P.greenDark + '30' },
  badgeTxt: { fontSize: 12, fontWeight: '600', color: P.greenDark },

  infoSection: { paddingVertical: 16, paddingHorizontal: 16 },
  infoSectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: P.charcoal, textTransform: 'uppercase', letterSpacing: 0.5 },
  editChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: P.orange50, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: P.terra },
  editChipIcon: { fontSize: 13 },
  editChipTxt: { fontSize: 12, fontWeight: '700', color: P.terra },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  infoRowIcon: { fontSize: 18, width: 28 },
  infoRowLabel: { fontSize: 11, color: P.muted, fontWeight: '600', marginBottom: 2 },
  infoRowValue: { fontSize: 14, fontWeight: '600', color: P.charcoal },

  // Menu
  menuSection: { marginHorizontal: 6, marginBottom: 20, gap: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: P.white, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: P.sand, elevation: 2, gap: 12 },
  menuItemIcon: { fontSize: 22, width: 28 },
  menuItemLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: P.charcoal },
  menuItemArrow: { fontSize: 22, color: P.terra },

  themeOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: P.sand, backgroundColor: P.white, marginBottom: 10, gap: 12 },
  themeOptionActive: { borderWidth: 1.5 },
  themeOptionIcon: { fontSize: 22 },
  themeOptionLabel: { fontSize: 15, fontWeight: '700', color: P.charcoal, marginBottom: 2 },
  themeOptionSub: { fontSize: 12, color: P.muted, lineHeight: 17 },

  // Logout
  logoutBtn: { marginHorizontal: 6, marginBottom: 20, borderRadius: 16, overflow: 'hidden', backgroundColor: P.white, borderWidth: 1, borderColor: P.error + '35', elevation: 4 },
  logoutAccent: { height: 3, backgroundColor: P.error },
  logoutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  logoutIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: P.error + '18', borderWidth: 1, borderColor: P.error + '40', alignItems: 'center', justifyContent: 'center' },
  logoutTxt: { fontSize: 15, fontWeight: '800', color: P.error },
  logoutHint: { fontSize: 11, color: P.muted, marginTop: 2 },

  // ── ACTION BUTTON (footer des sheets) ────────────────────────────────────
  actionBtn: {
    borderRadius: 100,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: P.orange700,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    marginBottom:60,
  },
  actionBtnDisabled: { opacity: 0.52 },
  actionBtnGrad: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionBtnIcon: { fontSize: 18 },
  actionBtnTxt: { color: P.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },

  // ── FORM FIELDS ──────────────────────────────────────────────────────────
  fieldLabel: { fontSize: 13, fontWeight: '700', color: P.charcoal, marginBottom: 9 },
  input: {
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 15,
    color: P.charcoal,
    backgroundColor: '#F8FAFB',
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top', paddingTop: 14 },

  selectRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16, backgroundColor: '#F8FAFB', gap: 10 },
  selectRowIcon: { fontSize: 18 },
  selectRowVal: { flex: 1, fontSize: 15, color: P.charcoal, fontWeight: '600' },
  selectRowArrow: { fontSize: 20, color: P.terra },

  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dialPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 15, backgroundColor: '#F8FAFB' },
  dialCode: { fontSize: 14, fontWeight: '700', color: P.charcoal },
  dialArrow: { fontSize: 11, color: P.muted },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, paddingVertical: 14, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 14, alignItems: 'center', backgroundColor: '#F8FAFB' },
  typeBtnActive: { borderColor: P.terra, backgroundColor: P.peachSoft || '#FFF3EE' },
  typeBtnTxt: { fontSize: 14, fontWeight: '600', color: P.muted },
  typeBtnTxtActive: { color: P.terra },

  // Avatar picker
  avatarPickerWrap: { borderRadius: 16, overflow: 'hidden', position: 'relative' },
  avatarPickerImg: { width: '100%', height: 190, borderRadius: 16 },
  avatarPickerFallback: { backgroundColor: '#F0F0F0', borderWidth: 2, borderColor: P.terra, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  avatarPickerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.48)', paddingVertical: 12, alignItems: 'center' },
  avatarPickerOverlayTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Security card
  secCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: P.orange50 || '#FFF8F0', borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: P.orange300 + '60' || '#FFD0A0' },
  secCardTitle: { fontSize: 15, fontWeight: '700', color: P.charcoal, marginBottom: 4 },
  secCardSub: { fontSize: 13, color: P.muted, lineHeight: 19 },

  // Password strength
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', minWidth: 56, textAlign: 'right' },
  matchRow: { marginTop: 8 },

  // List rows (ville / pays)
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.07)', gap: 10 },
  listRowActive: { backgroundColor: P.orange50 || '#FFF8F0' },
  listRowIcon: { fontSize: 18, width: 24 },
  listRowTxt: { flex: 1, fontSize: 15, color: P.charcoal, fontWeight: '500' },
  listRowDial: { fontSize: 13, color: P.muted },
});