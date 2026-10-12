// ─── ProfileScreen v3 ─ MarketHub Niger ──────────────────────────────────────
// Panneaux (apparence, édition) : CustomBottomSheet natif.
// Mot de passe : page dédiée SecurityScreen (navigation 'Security').

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  ActivityIndicator,
  TextInput,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';
import AlertModal from '../components/AlertModal';
import CustomBottomSheet, { SheetTextInput } from '../components/CustomBottomSheet';
import { updateProfile } from '../api/auth';
import { compressToBase64 } from '../api/products';
import { doneAccessory } from '../components/Keyboard';
import { sizedImage } from '../utils/format';

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
  const s = useProfileStyles();
  const { user, isAuthenticated, logout, updateUserProfile } = useAuth();
  const { isDark, theme, themePreference, setThemePreference } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [alert, setAlert] = useState({
    visible: false, type: 'info', title: '', message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  // Sheets visibility
  const [editSheet,     setEditSheet]     = useState(false);
  const [citySheet,     setCitySheet]     = useState(false);
  const [countrySheet,  setCountrySheet]  = useState(false);
  const [themeSheet,    setThemeSheet]    = useState(false);

  // Loaders
  const [loggingOut,       setLoggingOut]       = useState(false);
  const [savingProfile,    setSavingProfile]    = useState(false);

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

  const handleSelectImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') { showAlert('error', 'Permission refusée', 'Autorisez l\'accès à vos photos'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 1,
      });
      if (!res.canceled && res.assets?.[0]) {
        const p = res.assets[0];
        // Un avatar s'affiche en ≤ 120 px : 512 px suffisent (quelques dizaines de Ko au lieu de plusieurs Mo)
        try {
          setEditAvatarUri(await compressToBase64(p.uri, 512));
        } catch {
          setEditAvatarUri(p.uri);
        }
      }
    } catch { showAlert('error', 'Erreur', 'Impossible de sélectionner l\'image'); }
  };

  const getInitials = () => {
    if (!user?.name) return '?';
    const n = user.name.split(' ');
    return n.length >= 2 ? (n[0][0] + n[n.length - 1][0]).toUpperCase() : user.name.substring(0, 2).toUpperCase();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // NON-AUTH
  // ─────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={[s.container, { backgroundColor: theme.screen }]}>
        <LinearGradient colors={isDark ? [P.brown, P.charcoal] : theme.header} style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}>
          <View style={s.headerAccent} />
          <Text style={[s.headerTitle, { color: isDark ? P.white : theme.text }]}>Profil</Text>
        </LinearGradient>
        <ScrollView style={s.content}>
          <View style={s.notAuthBox}>
            <Text style={s.notAuthEmoji}>👤</Text>
            <Text style={[s.notAuthTitle, { color: theme.text }]}>Connectez-vous à votre compte</Text>
            <Text style={[s.notAuthText, { color: theme.textMuted }]}>Accédez à vos annonces, favoris, messages et bien plus</Text>
            <View style={{ width: '100%', gap: 12 }}>
              <TouchableOpacity
                style={s.loginBtn}
                onPress={() => navigation.navigate('QuickAuth', { pendingAction: { type: 'profile' }, returnScreen: 'Profile' })}
                activeOpacity={0.88}
              >
                <LinearGradient colors={[P.terra, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.loginBtnGrad}>
                  <Text style={s.loginBtnTxt}>Se connecter</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.registerBtn, { backgroundColor: theme.surface }]}
                onPress={() => navigation.navigate('QuickAuth', { pendingAction: { type: 'profile' }, returnScreen: 'Profile' })}
                activeOpacity={0.88}
              >
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

      {/* Bannière MDP */}
      {user?.needsPasswordChange && (
        <View style={[s.pwdBanner, { paddingTop: (insets.top || 0) + 12 }]}>
          <Text style={s.pwdBannerTxt}>🔒 Personnalisez votre mot de passe pour sécuriser votre compte.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Security')} style={s.pwdBannerBtn}>
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
        {/* Carte de profil : fond plein suivant le thème (le flou iOS sans teinte
            rendait les textes illisibles selon le mode) */}
        <Animated.View style={[s.profileCard, { opacity: headerAnim, transform: [{ scale: headerAnim.interpolate({ inputRange: [0,1], outputRange: [0.9, 1] }) }] }]}>
          <View style={[s.blurWrapper, { backgroundColor: theme.surface, borderColor: theme.border }, !isDark && s.cardShadow]}>
            <View style={s.avatarSection}>
              <View style={s.avatarWrap}>
                {user?.avatar
                  ? <Image source={{ uri: sizedImage(user.avatar, 120) }} style={[s.avatarImg, { backgroundColor: theme.surfaceAlt }]} />
                  : <View style={[s.avatarImg, s.avatarFallback]}><Text style={s.avatarInitials}>{getInitials()}</Text></View>
                }
                {user?.verified ? (
                  <View style={[s.verifiedMiniBadge, { borderColor: theme.surface }]}>
                    <Text style={s.verifiedMiniTxt}>✓</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={[s.avatarEdit, { borderColor: theme.surface }]} onPress={() => setEditSheet(true)} activeOpacity={0.75}>
                  <Text style={{ fontSize: 15 }}>✏️</Text>
                </TouchableOpacity>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[s.userName, { color: theme.text }]}>{user?.name || 'Utilisateur'}</Text>
                <Text style={[s.userEmail, { color: theme.textMuted }]}>{user?.email || user?.phone || ''}</Text>
              </View>
            </View>

            {/* Infos + bouton éditer */}
            <View style={[s.infoSection, { borderTopColor: theme.border }]}>
              <View style={s.infoSectionHead}>
                <Text style={[s.sectionLabel, { color: theme.textMuted }]}>Détails du compte</Text>
                <TouchableOpacity
                  onPress={() => setEditSheet(true)}
                  style={[s.editChip, isDark && { backgroundColor: 'rgba(236,90,19,0.16)', borderColor: P.amber }]}
                  activeOpacity={0.7}
                >
                  <Text style={s.editChipIcon}>✏️</Text>
                  <Text style={[s.editChipTxt, isDark && { color: P.amber }]}>Éditer</Text>
                </TouchableOpacity>
              </View>
              {user?.phone ? <InfoRow icon="📞" label="Téléphone" value={user.phone} /> : null}
              {(user?.city || user?.location) ? <InfoRow icon="📍" label="Ville" value={user?.city || user?.location} /> : null}
              <InfoRow
                icon="🏢"
                label="Type de compte"
                value={user?.businessType === 'professional'
                  ? `Professionnel${user?.businessName ? ` · ${user.businessName}` : ''}`
                  : 'Particulier'}
              />
            </View>
          </View>
        </Animated.View>

        {/* Menu items */}
        <View style={s.menuSection}>
          <MenuItem icon="🔐" label="Sécurité et Connexion" onPress={() => navigation.navigate('Security')} />
          <MenuItem icon="🌗" label={`Apparence : ${themePreference === 'system' ? 'Système' : themePreference === 'dark' ? 'Sombre' : 'Clair'}`} onPress={() => setThemeSheet(true)} />
          <MenuItem icon="📦" label="Mes annonces"          onPress={() => navigation.navigate('MyListingsTab')} />
        </View>

        {/* Logout */}
        <TouchableOpacity style={[s.logoutBtn, { backgroundColor: theme.surface }, isDark && { elevation: 0 }]} onPress={handleLogout} disabled={loggingOut} activeOpacity={0.85}>
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
                  <Text style={[s.logoutHint, { color: theme.textSoft }]}>Fermer votre session sur cet appareil</Text>
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
                active && { borderColor: isDark ? P.amber : P.terra, backgroundColor: isDark ? 'rgba(236,90,19,0.16)' : P.peachSoft },
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
          <SheetTextInput style={s.input} placeholder="Votre nom" placeholderTextColor={theme.textSoft}
            value={editName} onChangeText={setEditName} editable={!savingProfile} />
        </FieldGroup>

        {/* Ville */}
        <FieldGroup label="Ville">
          <TouchableOpacity style={s.selectRow} onPress={() => setCitySheet(true)} activeOpacity={0.75}>
            <Text style={s.selectRowIcon}>📍</Text>
            <Text style={[s.selectRowVal, !editCity && { color: theme.textSoft }]}>{editCity || 'Sélectionner une ville'}</Text>
            <Text style={s.selectRowArrow}>›</Text>
          </TouchableOpacity>
        </FieldGroup>

        {/* Email */}
        <FieldGroup label="Adresse email">
          <SheetTextInput style={s.input} placeholder="votre@email.com" placeholderTextColor={theme.textSoft}
            value={editEmail} onChangeText={setEditEmail} textContentType="emailAddress" autoComplete="email" keyboardType="email-address" autoCapitalize="none" editable={!savingProfile} />
        </FieldGroup>

        {/* WhatsApp */}
        <FieldGroup label="Numéro WhatsApp">
          <View style={s.phoneRow}>
            <TouchableOpacity style={s.dialPill} onPress={() => setCountrySheet(true)} activeOpacity={0.8} disabled={savingProfile}>
              <Text style={{ fontSize: 18 }}>{whatsappCountry.flag}</Text>
              <Text style={s.dialCode}>{whatsappCountry.dialCode}</Text>
              <Text style={s.dialArrow}>▾</Text>
            </TouchableOpacity>
            <SheetTextInput style={[s.input, { flex: 1 }]} placeholder="12 34 56 78" placeholderTextColor={theme.textSoft}
              value={editWhatsapp} onChangeText={setEditWhatsapp} {...doneAccessory} textContentType="telephoneNumber" autoComplete="tel" keyboardType="phone-pad" editable={!savingProfile} />
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
            <SheetTextInput style={s.input} placeholder="Nom de votre boutique / entreprise" placeholderTextColor={theme.textSoft}
              value={editBusinessName} onChangeText={setEditBusinessName} editable={!savingProfile} />
          </FieldGroup>
        )}

        {/* Description */}
        <FieldGroup label="Description / Bio">
          <SheetTextInput
            style={[s.input, s.inputMulti]}
            placeholder="Parlez-nous de vous..."
            placeholderTextColor={theme.textSoft}
            value={editDescription}
            onChangeText={setEditDescription}
            {...doneAccessory} multiline numberOfLines={3}
            textAlignVertical="top"
            editable={!savingProfile}
          />
        </FieldGroup>

        {/* Sélecteurs ouverts depuis ce panneau : déclarés À L'INTÉRIEUR pour
            pouvoir s'afficher par-dessus (iOS n'affiche pas deux Modal sœurs) */}

        {/* ── SHEET : VILLE ── */}
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

        {/* ── SHEET : PAYS WHATSAPP ── */}
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
      </CustomBottomSheet>

    </View>
  );
}

// ─── Petits composants locaux ─────────────────────────────────────────────────
function FieldGroup({ label, children }) {
  const s = useProfileStyles();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  const s = useProfileStyles();
  const { theme } = useAppTheme();
  return (
    <View style={s.infoRow}>
      <Text style={s.infoRowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.infoRowLabel, { color: theme.textSoft }]}>{label}</Text>
        <Text style={[s.infoRowValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function MenuItem({ icon, label, onPress }) {
  const s = useProfileStyles();
  const { theme, isDark } = useAppTheme();
  return (
    <TouchableOpacity
      style={[s.menuItem, { backgroundColor: theme.surface, borderColor: theme.border }, isDark && { elevation: 0 }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={s.menuItemIcon}>{icon}</Text>
      <Text style={[s.menuItemLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[s.menuItemArrow, isDark && { color: P.amber }]}>›</Text>
    </TouchableOpacity>
  );
}

const useProfileStyles = () => {
  const { theme, isDark } = useAppTheme();
  return useMemo(() => makeStyles(theme, isDark), [theme, isDark]);
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
// Styles dépendants du thème : textes, fonds et bordures suivent le mode clair/sombre
const makeStyles = (theme, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.screen },

  header: { paddingHorizontal: 18, paddingBottom: 8, overflow: 'hidden', position: 'relative' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerTitle: { fontSize: 25, fontWeight: '700', color: P.white, marginBottom: 2 },

  pwdBanner: {
    backgroundColor: P.orange100, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: P.orange300,
  },
  pwdBannerTxt: { flex: 1, fontSize: 13, color: P.orange700, fontWeight: '600', marginRight: 10 },
  pwdBannerBtn: { backgroundColor: P.orange600, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pwdBannerBtnTxt: { color: P.white, fontSize: 12, fontWeight: '700' },

  content: { flex: 1 },
  scrollContent: { paddingTop: 10, paddingHorizontal: 12 },

  // Non auth
  notAuthBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  notAuthEmoji: { fontSize: 60, marginBottom: 20 },
  notAuthTitle: { fontSize: 24, fontWeight: '700', color: theme.text, marginBottom: 12, textAlign: 'center' },
  notAuthText: { fontSize: 15, color: theme.textMuted, marginBottom: 40, textAlign: 'center', lineHeight: 22 },
  loginBtn: { overflow: 'hidden', borderRadius: 14, elevation: 6 },
  loginBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  loginBtnTxt: { fontSize: 15, fontWeight: '700', color: P.white },
  registerBtn: { paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: P.terra, borderRadius: 14, backgroundColor: theme.surface },
  registerBtnTxt: { fontSize: 15, fontWeight: '700', color: P.terra },

  // Profile card
  profileCard: { marginHorizontal: 6, marginBottom: 14, borderRadius: 18, overflow: 'hidden' },
  blurWrapper: { borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  cardShadow: { shadowColor: '#0f172a', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  avatarSection: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 14, gap: 8 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 94, height: 94, borderRadius: 47, borderWidth: 2.5, borderColor: P.terra, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarFallback: { backgroundColor: P.orange500 },
  avatarInitials: { fontSize: 34, fontWeight: '800', color: P.white },
  verifiedMiniBadge: {
    position: 'absolute',
    top: 2,
    right: -6,
    minWidth: 24,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: P.greenDark,
    borderWidth: 1.5,
    borderColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedMiniTxt: { fontSize: 10, fontWeight: '900', color: P.white, letterSpacing: -0.2 },
  avatarEdit: { position: 'absolute', bottom: -2, right: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: P.terra, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.surface },
  userName: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 1 },
  userEmail: { fontSize: 12, color: theme.textMuted, marginBottom: 2 },

  infoSection: { paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth },
  infoSectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: theme.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  editChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: (isDark ? 'rgba(236,90,19,0.16)' : P.orange50), paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: P.terra },
  editChipIcon: { fontSize: 13 },
  editChipTxt: { fontSize: 12, fontWeight: '700', color: P.terra },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  infoRowIcon: { fontSize: 18, width: 28 },
  infoRowLabel: { fontSize: 11, color: theme.textMuted, fontWeight: '600', marginBottom: 2 },
  infoRowValue: { fontSize: 14, fontWeight: '600', color: theme.text },

  // Menu
  menuSection: { marginHorizontal: 6, marginBottom: 16, gap: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.border, elevation: 2, gap: 10 },
  menuItemIcon: { fontSize: 22, width: 28 },
  menuItemLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.text },
  menuItemArrow: { fontSize: 22, color: P.terra },

  themeOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, marginBottom: 10, gap: 12 },
  themeOptionActive: { borderWidth: 1.5 },
  themeOptionIcon: { fontSize: 22 },
  themeOptionLabel: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 2 },
  themeOptionSub: { fontSize: 12, color: theme.textMuted, lineHeight: 17 },

  // Logout
  logoutBtn: { marginHorizontal: 6, marginBottom: 20, borderRadius: 16, overflow: 'hidden', backgroundColor: theme.surface, borderWidth: 1, borderColor: P.error + '35', elevation: 4 },
  logoutAccent: { height: 3, backgroundColor: P.error },
  logoutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  logoutIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: P.error + '18', borderWidth: 1, borderColor: P.error + '40', alignItems: 'center', justifyContent: 'center' },
  logoutTxt: { fontSize: 15, fontWeight: '800', color: P.error },
  logoutHint: { fontSize: 11, color: theme.textMuted, marginTop: 2 },

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
  fieldLabel: { fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 9 },
  input: {
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 15,
    color: theme.text,
    backgroundColor: theme.surfaceAlt,
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top', paddingTop: 14 },

  selectRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.border, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16, backgroundColor: theme.surfaceAlt, gap: 10 },
  selectRowIcon: { fontSize: 18 },
  selectRowVal: { flex: 1, fontSize: 15, color: theme.text, fontWeight: '600' },
  selectRowArrow: { fontSize: 20, color: P.terra },

  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dialPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: theme.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 15, backgroundColor: theme.surfaceAlt },
  dialCode: { fontSize: 14, fontWeight: '700', color: theme.text },
  dialArrow: { fontSize: 11, color: theme.textMuted },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, paddingVertical: 14, borderWidth: 1.5, borderColor: theme.border, borderRadius: 14, alignItems: 'center', backgroundColor: theme.surfaceAlt },
  typeBtnActive: { borderColor: P.terra, backgroundColor: (isDark ? 'rgba(236,90,19,0.16)' : P.orange50) },
  typeBtnTxt: { fontSize: 14, fontWeight: '600', color: theme.textMuted },
  typeBtnTxtActive: { color: P.terra },

  // Avatar picker
  avatarPickerWrap: { borderRadius: 16, overflow: 'hidden', position: 'relative' },
  avatarPickerImg: { width: '100%', height: 190, borderRadius: 16 },
  avatarPickerFallback: { backgroundColor: theme.surfaceAlt, borderWidth: 2, borderColor: P.terra, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  avatarPickerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.48)', paddingVertical: 12, alignItems: 'center' },
  avatarPickerOverlayTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Security card
  secCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: (isDark ? 'rgba(236,90,19,0.16)' : P.orange50), borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: P.orange300 + '60' || '#FFD0A0' },
  secCardTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 4 },
  secCardSub: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },

  // Password strength
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', minWidth: 56, textAlign: 'right' },
  matchRow: { marginTop: 8 },

  // List rows (ville / pays)
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, gap: 10 },
  listRowActive: { backgroundColor: (isDark ? 'rgba(236,90,19,0.16)' : P.orange50) },
  listRowIcon: { fontSize: 18, width: 24 },
  listRowTxt: { flex: 1, fontSize: 15, color: theme.text, fontWeight: '500' },
  listRowDial: { fontSize: 13, color: theme.textMuted },
});