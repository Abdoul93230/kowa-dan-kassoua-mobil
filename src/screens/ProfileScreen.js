// ─── ProfileScreen v4 ─ TakTak ───────────────────────────────────────────────
// En-tête immersif (anneau lumineux animé autour de l'avatar), statistiques,
// jauge de complétion du profil, éditeur photo dédié (caméra / galerie),
// formulaire d'édition repensé. Panneaux : CustomBottomSheet.
// Mot de passe : page dédiée SecurityScreen (navigation 'Security').

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { MOBILE_COLORS as P } from '../theme/colors';
import AlertModal from '../components/AlertModal';
import CustomBottomSheet from '../components/CustomBottomSheet';
import { updateProfile, apiClient } from '../api/auth';
import { compressToBase64, getMyStats } from '../api/products';
import { sizedImage } from '../utils/format';

const THEME_OPTIONS = [
  { value: 'system', label: 'Auto',   icon: 'phone-portrait-outline' },
  { value: 'light',  label: 'Clair',  icon: 'sunny-outline' },
  { value: 'dark',   label: 'Sombre', icon: 'moon-outline' },
];

const HERO_COLORS = ['#060a14', '#10172b', '#2a1307'];
const RING_COLORS = [P.terra, P.amber, '#8b5cf6', '#22d3ee', P.terra];

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

const compact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace('.0', '')}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace('.0', '')}k`;
  return String(v);
};

const initialsOf = (name) => {
  if (!name) return '?';
  const n = name.trim().split(/\s+/);
  return n.length >= 2 ? (n[0][0] + n[n.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
};

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const s = useProfileStyles();
  const { user, isAuthenticated, logout, updateUserProfile, refreshUserProfile } = useAuth();
  const { isDark, theme, themePreference, setThemePreference } = useAppTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  // Barre d'état claire sur l'en-tête sombre, foncée une fois l'en-tête dépassé (mode clair)
  const [pastHero, setPastHero] = useState(false);

  const [alert, setAlert] = useState({
    visible: false, type: 'info', title: '', message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  // Panneaux
  const [photoSheet,   setPhotoSheet]   = useState(false);

  // Chargements
  const [loggingOut,    setLoggingOut]    = useState(false);
  const [savingAvatar,  setSavingAvatar]  = useState(false);
  const [picking,       setPicking]       = useState(false);

  // Statistiques de mes annonces
  const [stats, setStats] = useState(null);
  // Note et nombre d'avis, calculés comme sur le profil public
  const [rep, setRep] = useState(null);

  // Photo choisie dans l'éditeur photo (pas encore enregistrée)
  const [pendingAvatar, setPendingAvatar] = useState(null);

  const enter = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  useFocusEffect(useCallback(() => {
    if (!isAuthenticated) return undefined;
    let alive = true;
    refreshUserProfile?.();
    getMyStats().then((res) => { if (alive && res?.data) setStats(res.data); }).catch(() => {});
    const uid = user?.id || user?._id;
    if (uid) {
      apiClient.get(`/auth/seller/${uid}`)
        .then((res) => { const d = res.data?.data; if (alive && d) setRep({ rating: Number(d.rating) || 0, reviews: Number(d.totalReviews) || 0 }); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [isAuthenticated, user?.id, user?._id]));

  const showAlert = (type, title, message, buttons) =>
    setAlert({ visible: true, type, title, message, buttons: buttons || [{ text: 'OK', onPress: () => {} }] });

  // ── Complétion du profil ─────────────────────────────────────────────────
  const completion = useMemo(() => {
    if (!user) return { percent: 0, missing: [] };
    const checks = [
      { key: 'photo', label: 'Photo', ok: !!user.avatar },
      { key: 'name', label: 'Nom', ok: !!user.name?.trim() },
      { key: 'city', label: 'Ville', ok: !!(user.city || user.location) },
      { key: 'email', label: 'E-mail', ok: !!user.email },
      { key: 'bio', label: 'Bio', ok: !!user.description?.trim() },
      ...(user.businessType === 'professional' ? [{ key: 'biz', label: 'Entreprise', ok: !!user.businessName?.trim() }] : []),
    ];
    const done = checks.filter((c) => c.ok).length;
    return { percent: Math.round((done / checks.length) * 100), missing: checks.filter((c) => !c.ok) };
  }, [user]);

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: completion.percent, duration: 900, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [completion.percent]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  // Formulaire : page dédiée (le clavier y est géré comme dans Sécurité et connexion)
  const openEdit = () => { tap(); navigation.navigate('EditProfile'); };
  const openPhoto = () => { tap(); setPendingAvatar(null); setPhotoSheet(true); };

  const handleLogout = () => {
    showAlert('warning', 'Se déconnecter', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', onPress: () => {} },
      { text: 'Déconnecter', onPress: async () => {
        setAlert((a) => ({ ...a, visible: false }));
        setLoggingOut(true);
        try { await logout(); navigation.navigate('Home'); }
        catch (e) { setLoggingOut(false); showAlert('error', 'Erreur', e.message); }
      }},
    ]);
  };

  // Ouvre la caméra ou la galerie, recadre en carré et compresse (512 px suffisent pour un avatar)
  const pickImage = async (source) => {
    tap();
    try {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        showAlert('error', 'Permission refusée', source === 'camera'
          ? 'Autorisez l\'accès à l\'appareil photo dans les réglages.'
          : 'Autorisez l\'accès à vos photos dans les réglages.');
        return null;
      }
      const options = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled || !res.assets?.[0]) return null;
      setPicking(true);
      try { return await compressToBase64(res.assets[0].uri, 512); }
      catch { return res.assets[0].uri; }
      finally { setPicking(false); }
    } catch {
      showAlert('error', 'Erreur', 'Impossible de récupérer la photo');
      return null;
    }
  };

  const handleSaveAvatar = async () => {
    if (!pendingAvatar) return;
    setSavingAvatar(true);
    try {
      const res = await updateProfile({ avatar: pendingAvatar });
      if (res.success) {
        await updateUserProfile(res?.data?.user || {});
        success();
        setPhotoSheet(false);
        setPendingAvatar(null);
      }
    } catch (e) {
      showAlert('error', 'Erreur', e.message || 'Impossible de mettre à jour la photo');
    } finally { setSavingAvatar(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // NON CONNECTÉ
  // ─────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={[s.container, { backgroundColor: theme.screen }]}>
      {/* En-tête sombre : icônes de la barre d'état en clair tant que l'écran est affiché */}
      {focused ? <StatusBar barStyle="light-content" backgroundColor="transparent" translucent /> : null}
        <LinearGradient colors={HERO_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.guestHero, { paddingTop: (insets.top || 0) + 40 }]}>
          <HeroBackdrop glow={glow} />
          <View style={s.guestIconRing}>
            <LinearGradient colors={RING_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={s.guestIconInner}>
              <Ionicons name="person-outline" size={40} color={P.white} />
            </View>
          </View>
          <Text style={s.guestTitle}>Votre espace TakTak</Text>
          <Text style={s.guestText}>Connectez-vous pour gérer vos annonces, vos favoris et vos messages.</Text>
        </LinearGradient>
        <View style={s.guestActions}>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => navigation.navigate('QuickAuth', { pendingAction: { type: 'profile' }, returnScreen: 'Profile' })}
            activeOpacity={0.88}
          >
            <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnGrad}>
              <Ionicons name="log-in-outline" size={20} color={P.white} />
              <Text style={s.primaryBtnTxt}>Se connecter</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.ghostBtn}
            onPress={() => navigation.navigate('QuickAuth', { pendingAction: { type: 'profile' }, returnScreen: 'Profile' })}
            activeOpacity={0.85}
          >
            <Text style={s.ghostBtnTxt}>Créer un compte</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────
  const isPro = user?.businessType === 'professional';
  const city = user?.city || user?.location;
  const rating = rep ? rep.rating : Number(user?.sellerStats?.rating) || 0;
  const reviews = rep ? rep.reviews : Number(user?.sellerStats?.totalReviews) || 0;
  const userId = user?.id || user?._id;
  const fade = (dy) => ({
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
  });

  return (
    <View style={[s.container, { backgroundColor: theme.screen }]}>
      {/* En-tête sombre : icônes de la barre d'état en clair tant que l'écran est affiché */}
      {focused ? <StatusBar barStyle={pastHero && !isDark ? 'dark-content' : 'light-content'} backgroundColor="transparent" translucent /> : null}
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 110 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = e.nativeEvent.contentOffset.y > 300;
          if (past !== pastHero) setPastHero(past);
        }}
      >
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <LinearGradient colors={HERO_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: (insets.top || 0) + 10 }]}>
          <HeroBackdrop glow={glow} />

          <View style={s.heroTop}>
            <Text style={s.heroKicker}>MON PROFIL</Text>
            <TouchableOpacity style={s.heroIconBtn} onPress={openEdit} activeOpacity={0.8} hitSlop={8}>
              <Ionicons name="create-outline" size={19} color={P.white} />
            </TouchableOpacity>
          </View>

          <Animated.View style={[s.heroCenter, { opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
            <AvatarRing uri={user?.avatar ? sizedImage(user.avatar, 240) : null} name={user?.name} size={108} gap="#0b1120" onPress={openPhoto}>
              <View style={s.cameraBadge}>
                <LinearGradient colors={[P.orange500, P.orange700]} style={StyleSheet.absoluteFill} />
                <Ionicons name="camera" size={15} color={P.white} />
              </View>
            </AvatarRing>
          </Animated.View>

          <Animated.View style={[s.heroInfo, fade(12)]}>
            <View style={s.nameRow}>
              <Text style={s.heroName} numberOfLines={1}>{user?.name || 'Utilisateur'}</Text>
              {user?.verified ? <Ionicons name="checkmark-circle" size={20} color="#38bdf8" /> : null}
            </View>
            {isPro && user?.businessName ? <Text style={s.heroBiz} numberOfLines={1}>{user.businessName}</Text> : null}
            <Text style={s.heroSub} numberOfLines={1}>{user?.email || user?.phone || ''}</Text>

            <View style={s.chipsRow}>
              <HeroChip icon={isPro ? 'briefcase-outline' : 'person-outline'} label={isPro ? 'Professionnel' : 'Particulier'} accent />
              {city ? <HeroChip icon="location-outline" label={city} /> : null}
              {user?.memberSince ? <HeroChip icon="time-outline" label={`Depuis ${user.memberSince}`} /> : null}
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ── STATISTIQUES ─────────────────────────────────────────────── */}
        <Animated.View style={[s.statsCard, fade(20)]}>
          <Stat value={stats ? compact(stats.totalActive) : '—'} label="En ligne" icon="radio-button-on" tint={P.green} onPress={() => navigation.navigate('MyListingsTab')} />
          <View style={s.statDivider} />
          <Stat value={stats ? compact(stats.totalViews) : '—'} label="Vues" icon="eye-outline" tint="#38bdf8" onPress={() => navigation.navigate('MyListingsTab')} />
          <View style={s.statDivider} />
          <Stat value={stats ? compact(stats.totalFavorites) : '—'} label="Favoris" icon="heart-outline" tint={P.error} onPress={() => navigation.navigate('MyListingsTab')} />
          <View style={s.statDivider} />
          <Stat value={reviews ? rating.toFixed(1) : '—'} label={reviews ? `${reviews} avis` : 'Avis'} icon="star" tint={P.gold} />
        </Animated.View>

        <View style={s.body}>
          {/* Mot de passe à personnaliser */}
          {user?.needsPasswordChange ? (
            <TouchableOpacity style={s.alertCard} onPress={() => navigation.navigate('Security')} activeOpacity={0.85}>
              <View style={[s.alertIcon, { backgroundColor: P.gold + '22' }]}>
                <Ionicons name="shield-half-outline" size={20} color={P.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.alertTitle}>Sécurisez votre compte</Text>
                <Text style={s.alertSub}>Choisissez votre propre mot de passe.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={P.gold} />
            </TouchableOpacity>
          ) : null}

          {/* Complétion du profil */}
          {completion.percent < 100 ? (
            <Animated.View style={fade(24)}>
              <TouchableOpacity
                style={s.completeCard}
                activeOpacity={0.88}
                onPress={completion.missing[0]?.key === 'photo' ? openPhoto : openEdit}
              >
                <View style={s.completeHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.completeTitle}>Profil complété à {completion.percent} %</Text>
                    <Text style={s.completeSub} numberOfLines={1}>
                      Ajoutez : {completion.missing.map((m) => m.label).join(' · ')}
                    </Text>
                  </View>
                  <View style={s.completeCta}>
                    <Text style={s.completeCtaTxt}>Compléter</Text>
                    <Ionicons name="arrow-forward" size={14} color={P.terra} />
                  </View>
                </View>
                <View style={s.track}>
                  <Animated.View style={[s.trackFill, { width: progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}>
                    <LinearGradient colors={[P.terra, P.amber, '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  </Animated.View>
                </View>
                <Text style={s.completeHint}>Un profil complet inspire confiance aux acheteurs.</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {/* Bio */}
          {user?.description ? (
            <View style={s.bioCard}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color={theme.iconMuted} />
              <Text style={s.bioTxt} numberOfLines={4}>{user.description}</Text>
            </View>
          ) : null}

          {/* Activité */}
          <Text style={s.groupLabel}>Activité</Text>
          <View style={s.group}>
            <Row icon="cube-outline" tint={P.terra} label="Mes annonces"
              sub={stats ? `${stats.totalAll || 0} au total · ${stats.totalSold || 0} vendue${(stats.totalSold || 0) > 1 ? 's' : ''}` : 'Gérer, modifier, marquer vendu'}
              onPress={() => navigation.navigate('MyListingsTab')} />
            {userId ? (
              <Row icon="eye-outline" tint="#38bdf8" label="Voir mon profil public" sub="Tel que les acheteurs le voient"
                onPress={() => navigation.navigate('SellerProfile', { sellerId: userId })} />
            ) : null}
            <Row icon="heart-outline" tint={P.error} label="Mes favoris" sub="Les annonces que vous suivez"
              onPress={() => navigation.navigate('Favorites')} last />
          </View>

          {/* Compte */}
          <Text style={s.groupLabel}>Compte</Text>
          <View style={s.group}>
            <Row icon="person-circle-outline" tint="#8b5cf6" label="Informations personnelles" sub="Nom, ville, e-mail, bio" onPress={openEdit} />
            <Row icon="image-outline" tint={P.amber} label="Photo de profil" sub={user?.avatar ? 'Changer votre photo' : 'Ajouter une photo'} onPress={openPhoto} />
            <Row icon="lock-closed-outline" tint={P.green} label="Sécurité et connexion" sub="Mot de passe, appareils connectés"
              onPress={() => navigation.navigate('Security')}
              badge={user?.needsPasswordChange ? 'Action requise' : null} last />
          </View>

          {/* Apparence */}
          <Text style={s.groupLabel}>Apparence</Text>
          <View style={s.segment}>
            {THEME_OPTIONS.map((o) => {
              const active = themePreference === o.value;
              return (
                <Pressable key={o.value} style={s.segmentItem} onPress={() => { tap(); setThemePreference(o.value); }}>
                  {active ? (
                    <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, s.segmentActive]} />
                  ) : null}
                  <Ionicons name={o.icon} size={17} color={active ? P.white : theme.textMuted} />
                  <Text style={[s.segmentTxt, active && { color: P.white }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Déconnexion */}
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} disabled={loggingOut} activeOpacity={0.85}>
            {loggingOut
              ? <ActivityIndicator color={P.error} size="small" />
              : <Ionicons name="log-out-outline" size={20} color={P.error} />}
            <Text style={s.logoutTxt}>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</Text>
          </TouchableOpacity>

          <Text style={s.footerTxt}>TakTak · Achetez et vendez près de chez vous</Text>
        </View>
      </ScrollView>

      {/* Bandeau sous la barre d'état une fois l'en-tête dépassé (le contenu ne passe plus sous l'heure) */}
      {pastHero ? <View pointerEvents="none" style={[s.statusScrim, { height: insets.top || 0 }]} /> : null}

      <AlertModal
        visible={alert.visible} type={alert.type}
        title={alert.title} message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert((a) => ({ ...a, visible: false }))}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PANNEAU : PHOTO DE PROFIL                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <CustomBottomSheet
        visible={photoSheet}
        onClose={() => { if (!savingAvatar) { setPhotoSheet(false); setPendingAvatar(null); } }}
        title="Photo de profil"
        avoidKeyboard={false}
        footer={pendingAvatar ? (
          <View style={s.photoFooter}>
            <TouchableOpacity style={s.photoCancel} onPress={() => setPendingAvatar(null)} disabled={savingAvatar} activeOpacity={0.8}>
              <Text style={s.photoCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, { flex: 1 }]} onPress={handleSaveAvatar} disabled={savingAvatar} activeOpacity={0.88}>
              <LinearGradient colors={[P.orange500, P.orange700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnGrad}>
                {savingAvatar
                  ? <ActivityIndicator color={P.white} />
                  : <><Ionicons name="checkmark" size={20} color={P.white} /><Text style={s.primaryBtnTxt}>Enregistrer</Text></>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : null}
      >
        <View style={s.photoStage}>
          <AvatarRing
            uri={pendingAvatar || (user?.avatar ? sizedImage(user.avatar, 400) : null)}
            name={user?.name}
            size={176}
            gap={theme.surface}
            spinning
          >
            {picking ? (
              <View style={s.photoBusy}><ActivityIndicator color={P.white} size="large" /></View>
            ) : null}
          </AvatarRing>
          <View style={[s.photoTag, pendingAvatar && s.photoTagNew]}>
            <Ionicons name={pendingAvatar ? 'sparkles' : 'person-outline'} size={12} color={pendingAvatar ? P.white : theme.textMuted} />
            <Text style={[s.photoTagTxt, pendingAvatar && { color: P.white }]}>{pendingAvatar ? 'Aperçu' : 'Photo actuelle'}</Text>
          </View>
        </View>

        <View style={s.photoActions}>
          <PhotoAction icon="camera-outline" label="Appareil photo" sub="Prendre une photo" disabled={picking || savingAvatar}
            onPress={async () => { const img = await pickImage('camera'); if (img) setPendingAvatar(img); }} />
          <PhotoAction icon="images-outline" label="Galerie" sub="Choisir une image" disabled={picking || savingAvatar}
            onPress={async () => { const img = await pickImage('library'); if (img) setPendingAvatar(img); }} />
        </View>

        <View style={s.photoTips}>
          <Ionicons name="bulb-outline" size={16} color={P.gold} />
          <Text style={s.photoTipsTxt}>
            Une photo nette de votre visage ou de votre logo, bien éclairée, inspire confiance aux acheteurs.
          </Text>
        </View>
      </CustomBottomSheet>

    </View>
  );
}

// ─── Composants locaux ────────────────────────────────────────────────────────

// Halos lumineux + grille fine en fond de l'en-tête
function HeroBackdrop({ glow }) {
  const s = useProfileStyles();
  const pulse = glow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });
  const drift = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[0.2, 0.4, 0.6, 0.8].map((p) => <View key={`h${p}`} style={[s.gridH, { top: `${p * 100}%` }]} />)}
      {[0.2, 0.4, 0.6, 0.8].map((p) => <View key={`v${p}`} style={[s.gridV, { left: `${p * 100}%` }]} />)}
      <Animated.View style={[s.orbTerra, { opacity: pulse, transform: [{ translateX: drift }] }]}><Orb size={300} color="236,90,19" /></Animated.View>
      <Animated.View style={[s.orbViolet, { opacity: pulse, transform: [{ translateY: drift }] }]}><Orb size={260} color="124,58,237" /></Animated.View>
      <LinearGradient colors={['transparent', 'rgba(6,10,20,0.55)']} style={s.heroFade} />
    </View>
  );
}

// Halo flou simulé par des disques concentriques très transparents
const ORB_STEPS = Array.from({ length: 12 }, (_, i) => 1 - i * 0.065);
function Orb({ size, color }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {ORB_STEPS.map((k) => (
        <View key={k} style={{ position: 'absolute', width: size * k, height: size * k, borderRadius: size, backgroundColor: `rgba(${color},0.055)` }} />
      ))}
    </View>
  );
}

// Avatar entouré d'un anneau dégradé qui tourne lentement
function AvatarRing({ uri, name, size, gap, onPress, spinning = true, children }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spinning) return undefined;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spinning]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const outer = size + 10;
  const inner = size + 4;
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: outer / 2, overflow: 'hidden', transform: [{ rotate }] }]}>
        <LinearGradient colors={RING_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      </Animated.View>
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: gap, alignItems: 'center', justifyContent: 'center' }}>
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={200} />
        ) : (
          <LinearGradient colors={['#1e293b', '#3b1d0c']} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: P.white, fontSize: size * 0.34, fontWeight: '800', letterSpacing: 1 }}>{initialsOf(name)}</Text>
          </LinearGradient>
        )}
      </View>
      {children}
    </Wrapper>
  );
}

function HeroChip({ icon, label, accent }) {
  const s = useProfileStyles();
  return (
    <View style={[s.heroChip, accent && s.heroChipAccent]}>
      <Ionicons name={icon} size={12} color={accent ? P.amber : 'rgba(255,255,255,0.8)'} />
      <Text style={[s.heroChipTxt, accent && { color: P.amber }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Stat({ value, label, icon, tint, onPress }) {
  const s = useProfileStyles();
  return (
    <TouchableOpacity style={s.stat} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <View style={s.statValueRow}>
        <Ionicons name={icon} size={12} color={tint} />
        <Text style={s.statValue}>{value}</Text>
      </View>
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function Row({ icon, tint, label, sub, onPress, badge, last }) {
  const s = useProfileStyles();
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity style={[s.row, !last && s.rowBorder]} onPress={() => { tap(); onPress?.(); }} activeOpacity={0.7}>
      <View style={[s.rowIcon, { backgroundColor: tint + '1f', borderColor: tint + '40' }]}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {badge ? <View style={s.rowBadge}><Text style={s.rowBadgeTxt}>{badge}</Text></View> : null}
      <Ionicons name="chevron-forward" size={18} color={theme.iconMuted} />
    </TouchableOpacity>
  );
}

function PhotoAction({ icon, label, sub, onPress, disabled }) {
  const s = useProfileStyles();
  return (
    <TouchableOpacity style={[s.photoAction, disabled && s.btnDisabled]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <LinearGradient colors={[P.orange500 + '26', '#8b5cf6' + '1a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.photoActionIcon}>
        <Ionicons name={icon} size={24} color={P.terra} />
      </View>
      <Text style={s.photoActionLabel}>{label}</Text>
      <Text style={s.photoActionSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

const useProfileStyles = () => {
  const { theme, isDark } = useAppTheme();
  return useMemo(() => makeStyles(theme, isDark), [theme, isDark]);
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const makeStyles = (theme, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.screen },

  // ── Hero ──
  hero: { paddingHorizontal: 18, paddingBottom: 52, overflow: 'hidden', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.06)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.06)' },
  orbTerra: { position: 'absolute', top: -130, right: -120 },
  orbViolet: { position: 'absolute', bottom: -110, left: -110 },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  heroKicker: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800', letterSpacing: 2.5 },
  heroIconBtn: {
    width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  heroCenter: { alignItems: 'center' },
  cameraBadge: {
    position: 'absolute', right: 2, bottom: 4, width: 34, height: 34, borderRadius: 17, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#0b1120',
  },
  heroInfo: { alignItems: 'center', marginTop: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '90%' },
  heroName: { color: P.white, fontSize: 24, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 },
  heroBiz: { color: P.amber, fontSize: 13, fontWeight: '700', marginTop: 2 },
  heroSub: { color: 'rgba(255,255,255,0.62)', fontSize: 13, marginTop: 3 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 14 },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', maxWidth: 200,
  },
  heroChipAccent: { backgroundColor: 'rgba(236,90,19,0.18)', borderColor: 'rgba(255,168,123,0.45)' },
  heroChipTxt: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },

  // ── Stats ──
  statsCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: -34, paddingVertical: 14,
    borderRadius: 22, backgroundColor: theme.surface, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)',
    shadowColor: '#0f172a', shadowOpacity: isDark ? 0.5 : 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 11, fontWeight: '600', color: theme.textSoft },
  statDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: theme.border },

  body: { paddingHorizontal: 16, paddingTop: 16 },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: theme.screen, opacity: 0.96 },

  // ── Cartes ──
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, marginBottom: 12,
    backgroundColor: isDark ? 'rgba(245,158,11,0.10)' : '#fffbeb', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
  },
  alertIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
  alertSub: { fontSize: 12, color: theme.textMuted, marginTop: 1 },

  completeCard: {
    padding: 16, borderRadius: 20, marginBottom: 12, backgroundColor: theme.surface,
    borderWidth: 1, borderColor: isDark ? 'rgba(139,92,246,0.35)' : 'rgba(139,92,246,0.22)',
  },
  completeHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  completeTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  completeSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  completeCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: isDark ? 'rgba(236,90,19,0.16)' : P.orange50,
  },
  completeCtaTxt: { fontSize: 12, fontWeight: '800', color: P.terra },
  track: { height: 8, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#eef0f4', overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 4, overflow: 'hidden' },
  completeHint: { fontSize: 11, color: theme.textSoft, marginTop: 10 },

  bioCard: {
    flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, marginBottom: 4,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  bioTxt: { flex: 1, fontSize: 13, lineHeight: 19, color: theme.textMuted },

  // ── Groupes ──
  groupLabel: { fontSize: 12, fontWeight: '800', color: theme.textSoft, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 18, marginBottom: 8, marginLeft: 4 },
  group: { borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: theme.text },
  rowSub: { fontSize: 12, color: theme.textSoft, marginTop: 1 },
  rowBadge: { backgroundColor: P.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  rowBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#111827' },

  segment: {
    flexDirection: 'row', padding: 5, borderRadius: 18, gap: 5,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14, overflow: 'hidden' },
  segmentActive: { borderRadius: 14 },
  segmentTxt: { fontSize: 13, fontWeight: '700', color: theme.textMuted },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 26, paddingVertical: 15,
    borderRadius: 18, borderWidth: 1, borderColor: P.error + '55', backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#fff5f5',
  },
  logoutTxt: { fontSize: 15, fontWeight: '800', color: P.error },
  footerTxt: { textAlign: 'center', fontSize: 11, color: theme.textSoft, marginTop: 16 },

  // ── Non connecté ──
  guestHero: { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 48, overflow: 'hidden', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  guestIconRing: { width: 104, height: 104, borderRadius: 52, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  guestIconInner: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#0b1120', alignItems: 'center', justifyContent: 'center' },
  guestTitle: { color: P.white, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  guestText: { color: 'rgba(255,255,255,0.68)', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  guestActions: { padding: 20, gap: 12, marginTop: 8 },

  // ── Boutons ──
  primaryBtn: {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: P.orange700, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  primaryBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  primaryBtnTxt: { color: P.white, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  ghostBtn: { paddingVertical: 15, alignItems: 'center', borderRadius: 18, borderWidth: 1.5, borderColor: P.terra },
  ghostBtnTxt: { fontSize: 15, fontWeight: '800', color: P.terra },
  saveBtn: { marginBottom: 60 },
  btnDisabled: { opacity: 0.5 },

  // ── Éditeur photo ──
  photoStage: { alignItems: 'center', paddingVertical: 8, marginBottom: 18 },
  photoBusy: { ...StyleSheet.absoluteFillObject, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  photoTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border,
  },
  photoTagNew: { backgroundColor: P.terra, borderColor: P.terra },
  photoTagTxt: { fontSize: 12, fontWeight: '700', color: theme.textMuted },
  photoActions: { flexDirection: 'row', gap: 12 },
  photoAction: {
    flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: isDark ? 'rgba(255,168,123,0.25)' : 'rgba(236,90,19,0.18)', backgroundColor: theme.surfaceAlt,
  },
  photoActionIcon: {
    width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: isDark ? 'rgba(255,168,123,0.3)' : 'rgba(236,90,19,0.2)',
  },
  photoActionLabel: { fontSize: 14, fontWeight: '800', color: theme.text },
  photoActionSub: { fontSize: 11, color: theme.textSoft, marginTop: 2 },
  photoTips: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16, marginBottom: 30, padding: 12, borderRadius: 14,
    backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : '#fffbeb',
  },
  photoTipsTxt: { flex: 1, fontSize: 12, lineHeight: 18, color: theme.textMuted },
  photoFooter: { flexDirection: 'row', gap: 10, marginBottom: 60 },
  photoCancel: { paddingHorizontal: 20, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
  photoCancelTxt: { fontSize: 15, fontWeight: '700', color: theme.textMuted },

  // ── Formulaire ──
  editPhotoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 20, marginBottom: 6,
    backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border,
  },
  editPhotoTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
  miniBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: isDark ? 'rgba(236,90,19,0.14)' : P.orange50, borderWidth: 1, borderColor: isDark ? 'rgba(255,168,123,0.3)' : P.orange200,
  },
  miniBtnTxt: { fontSize: 12, fontWeight: '800', color: P.terra },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, marginBottom: 12 },
  sectionTitleTxt: { fontSize: 12, fontWeight: '800', color: theme.text, letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionTitleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: 4 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.textMuted, marginBottom: 7, marginLeft: 2 },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 52, borderRadius: 16,
    backgroundColor: theme.surfaceAlt, borderWidth: 1.5, borderColor: theme.border,
  },
  fieldBoxMulti: { alignItems: 'flex-start', paddingTop: 14 },
  fieldBoxFocus: { borderColor: P.terra, backgroundColor: isDark ? 'rgba(236,90,19,0.07)' : '#fffaf7' },
  fieldInput: { flex: 1, fontSize: 15, color: theme.text, paddingVertical: 14 },
  fieldInputMulti: { minHeight: 96, paddingTop: 0 },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: theme.textSoft, marginTop: 5 },
  selectVal: { flex: 1, fontSize: 15, color: theme.text, fontWeight: '600' },

  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 4 },
  dialPill: { gap: 6, paddingHorizontal: 12 },
  dialCode: { fontSize: 14, fontWeight: '700', color: theme.text },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeCard: {
    flex: 1, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.surfaceAlt,
  },
  typeCardActive: { borderColor: P.terra, backgroundColor: isDark ? 'rgba(236,90,19,0.12)' : P.orange50 },
  typeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, marginBottom: 10 },
  typeLabel: { fontSize: 14, fontWeight: '800', color: theme.text },
  typeSub: { fontSize: 11, color: theme.textSoft, marginTop: 2 },
  typeCheck: { position: 'absolute', top: 10, right: 10 },

  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, gap: 12, borderRadius: 10 },
  listRowActive: { backgroundColor: isDark ? 'rgba(236,90,19,0.16)' : P.orange50 },
  listRowTxt: { flex: 1, fontSize: 15, color: theme.text, fontWeight: '500' },
  listRowDial: { fontSize: 13, color: theme.textMuted },
});
