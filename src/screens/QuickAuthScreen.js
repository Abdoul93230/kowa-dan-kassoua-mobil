// ─── QuickAuthScreen — Mode 1 : Authentification contextuelle ─────────────────
// Déclenché quand un utilisateur non connecté tente une action protégée
// Étape 1 : Numéro de téléphone → check-phone
// Étape 2a : Numéro connu → Login (phone pré-rempli + password)
// Étape 2b : Numéro inconnu → Formulaire minimal (nom) → sendOTP → VerifyOTP → quickRegister

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image,
  ScrollView, StatusBar, Animated, KeyboardAvoidingView,
  Platform, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { checkPhone, sendOTP } from '../api/auth';
import { MOBILE_COLORS as P } from '../theme/colors';

const COUNTRIES = [
  { code: 'NE', name: 'Niger',         dialCode: '+227', flag: '🇳🇪', nationalLength: 8, phoneGroups: [2, 2, 2, 2], sample: '90 12 34 56' },
  { code: 'SN', name: 'Sénégal',       dialCode: '+221', flag: '🇸🇳', nationalLength: 9, phoneGroups: [2, 3, 2, 2], sample: '77 123 45 67' },
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225', flag: '🇨🇮', nationalLength: 10, phoneGroups: [2, 2, 2, 2, 2], sample: '07 12 34 56 78' },
  { code: 'BF', name: 'Burkina Faso',  dialCode: '+226', flag: '🇧🇫', nationalLength: 8, phoneGroups: [2, 2, 2, 2], sample: '70 12 34 56' },
  { code: 'ML', name: 'Mali',          dialCode: '+223', flag: '🇲🇱', nationalLength: 8, phoneGroups: [2, 2, 2, 2], sample: '60 12 34 56' },
  { code: 'TG', name: 'Togo',          dialCode: '+228', flag: '🇹🇬', nationalLength: 8, phoneGroups: [2, 2, 2, 2], sample: '90 12 34 56' },
  { code: 'BJ', name: 'Bénin',         dialCode: '+229', flag: '🇧🇯', nationalLength: 8, phoneGroups: [2, 2, 2, 2], sample: '90 12 34 56' },
];

const normalizePhoneDigits = (value = '') =>
  String(value)
    .replace(/\D/g, '')
    .replace(/^0+/, '');

const formatNationalPhone = (country, digits) => {
  const chunks = [];
  let cursor = 0;
  const groups = country?.phoneGroups || [];

  groups.forEach((size) => {
    if (cursor >= digits.length) return;
    const part = digits.slice(cursor, cursor + size);
    if (part) chunks.push(part);
    cursor += size;
  });

  if (cursor < digits.length) {
    chunks.push(digits.slice(cursor));
  }

  return chunks.join(' ').trim();
};

const validatePhoneForCountry = (country, digits) => {
  const maxLen = country?.nationalLength || 8;

  if (!digits) return 'Numéro requis';
  if (digits.length !== maxLen) {
    return `Le numéro doit contenir ${maxLen} chiffres pour ${country?.name}.`;
  }
  if (/^(\d)\1+$/.test(digits)) {
    return 'Numéro invalide';
  }

  return '';
};

// Étapes du parcours contextuel
const STEP_PHONE = 'phone';       // Saisie du numéro
const STEP_LOGIN = 'login';       // Numéro connu → login
const STEP_REGISTER = 'register'; // Numéro inconnu → nom + envoi OTP

export default function QuickAuthScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useAppTheme();
  const { login } = useAuth();

  // Params passés par la navigation (action en attente)
  const pendingAction = route.params?.pendingAction;
  const returnScreen = route.params?.returnScreen;
  const returnParams = route.params?.returnParams;
  const publishDraft = pendingAction?.type === 'publish_submit' ? pendingAction?.params?.draftSummary : null;
  const isPublishFlow = pendingAction?.type === 'publish_submit';

  const [step, setStep] = useState(STEP_PHONE);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accent = P.terra;

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = (forward = true) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: forward ? -30 : 30, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(forward ? 30 : -30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 10, useNativeDriver: true }),
      ]).start();
    });
  };

  const handlePhoneChange = (rawValue) => {
    const maxDigits = country?.nationalLength || 8;
    const digits = normalizePhoneDigits(rawValue).slice(0, maxDigits);
    setPhone(formatNationalPhone(country, digits));
    setError('');
  };

  useEffect(() => {
    const maxDigits = country?.nationalLength || 8;
    const currentDigits = normalizePhoneDigits(phone).slice(0, maxDigits);
    setPhone(formatNationalPhone(country, currentDigits));
  }, [country]);

  // ── Étape 1 : Vérifier le numéro ──
  const handleCheckPhone = async () => {
    const phoneDigits = normalizePhoneDigits(phone);
    const phoneErr = validatePhoneForCountry(country, phoneDigits);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fmtPhone = `${country.dialCode} ${phoneDigits}`;
      const result = await checkPhone(fmtPhone);
      
      if (result.data?.exists) {
        // Numéro connu → étape login dans QuickAuth (ne pas sauter d'étape)
        animateTransition(true);
        setStep(STEP_LOGIN);
      } else {
        // Numéro inconnu → afficher formulaire minimal
        animateTransition(true);
        setStep(STEP_REGISTER);
      }
    } catch (e) {
      setError(e.message || 'Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  };

  // ── Étape 2a : Login (numéro connu) ──
  const handleLogin = async () => {
    const phoneDigits = normalizePhoneDigits(phone);
    const phoneErr = validatePhoneForCountry(country, phoneDigits);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }

    if (!password) {
      setError('Mot de passe requis');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fmtPhone = `${country.dialCode} ${phoneDigits}`;
      const result = await login(fmtPhone, password);
      if (!result.success) {
        setError(result.message || 'Identifiants incorrects');
        return;
      }
      // Succès → retourner à l'écran d'origine
      handleAuthSuccess();
    } catch (e) {
      setError(e.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  // ── Étape 2b : Inscription rapide (numéro inconnu) ──
  const handleQuickRegister = async () => {
    const phoneDigits = normalizePhoneDigits(phone);
    const phoneErr = validatePhoneForCountry(country, phoneDigits);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }

    if (!name.trim() || name.trim().length < 2) {
      setError('Minimum 2 caractères pour le nom');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fmtPhone = `${country.dialCode} ${phoneDigits}`;
      const result = await sendOTP(fmtPhone);
      
      if (result.success) {
        navigation.navigate('VerifyOTP', {
          phone: fmtPhone,
          type: 'quick-register',
          attemptsRemaining: result.data?.attemptsRemaining || 3,
          devCode: result.devOTP || result.data?.devOTP,
          formData: {
            name: name.trim(),
            phone: fmtPhone,
          },
          pendingAction,
          returnScreen,
          returnParams,
        });
      }
    } catch (e) {
      setError(e.message || "Erreur lors de l'envoi du code");
    } finally {
      setLoading(false);
    }
  };

  // ── Succès d'authentification ──
  const handleAuthSuccess = () => {
    const targetParams = returnParams || pendingAction?.params || {};

    if (returnScreen) {
      const mainTabs = ['Home', 'Favorites', 'Publish', 'Messages', 'Profile'];
      if (mainTabs.includes(returnScreen)) {
        navigation.navigate({
          name: 'MainTabs',
          params: {
            screen: returnScreen,
            params: targetParams,
          },
          merge: true,
        });
      } else {
        navigation.navigate({
          name: returnScreen,
          params: targetParams,
          merge: true,
        });
      }
    } else {
      navigation.goBack();
    }
  };

  // ── Retour en arrière dans le flow ──
  const handleBack = () => {
    if (step !== STEP_PHONE) {
      animateTransition(false);
      setStep(STEP_PHONE);
      setPassword('');
      setError('');
    } else {
      navigation.goBack();
    }
  };

  const phoneDigits = normalizePhoneDigits(phone);
  const fmtPhone = `${country.dialCode} ${formatNationalPhone(country, phoneDigits)}`;

  // ── Titre et sous-titre dynamiques ──
  const getTitle = () => {
    if (isPublishFlow) {
      switch (step) {
        case STEP_PHONE: return 'Finaliser la publication';
        case STEP_LOGIN: return 'Publier maintenant';
        case STEP_REGISTER: return 'Validation rapide';
        default: return '';
      }
    }

    switch (step) {
      case STEP_PHONE: return 'Votre numéro';
      case STEP_LOGIN: return 'Bon retour ! 👋';
      case STEP_REGISTER: return 'Bienvenue ! ✨';
      default: return '';
    }
  };

  const getSubtitle = () => {
    if (isPublishFlow) {
      switch (step) {
        case STEP_PHONE: return 'Connexion requise pour terminer';
        case STEP_LOGIN: return 'Encore une étape et c\'est publié';
        case STEP_REGISTER: return 'Vérifiez votre numéro pour publier';
        default: return '';
      }
    }

    switch (step) {
      case STEP_PHONE: return 'Saisissez votre numéro pour un accès express';
      case STEP_LOGIN: return 'Votre mot de passe pour continuer';
      case STEP_REGISTER: return 'Créons d\'abord votre profil rapide';
      default: return '';
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: theme.screen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ── HEADER ── */}
      <LinearGradient
        colors={theme.header}
        style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}
      >
        <View style={[s.headerAccent, { backgroundColor: accent }]} />
        <View style={s.headerRow}>
          <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.glass }]} onPress={handleBack} activeOpacity={0.8}>
            <Text style={[s.backBtnTxt, { color: theme.text }]}>←</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <LinearGradient colors={[P.orange500, P.orange700]} style={s.logoMini}>
              <Text style={s.logoMiniTxt}>M</Text>
            </LinearGradient>
            <Text style={[s.headerBrand, { color: theme.text }]}>MarketHub</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* Indicateur d'étape */}
        <View style={s.stepIndicator}>
          <View style={[s.stepDot, { backgroundColor: theme.divider }, s.stepDotActive, { backgroundColor: accent }]} />
          <View style={[s.stepDot, { backgroundColor: theme.divider }, step !== STEP_PHONE && s.stepDotActive, step !== STEP_PHONE && { backgroundColor: accent }]} />
          {step === STEP_REGISTER && <View style={[s.stepDot, { backgroundColor: accent }]} />}
        </View>

        <LinearGradient
          colors={[theme.divider, accent, theme.divider]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.headerGlow}
        />
      </LinearGradient>

      {/* ── CONTENU ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          {publishDraft ? (
            <View style={[s.publishDraftCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
              <View style={[s.publishDraftThumb, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                {publishDraft.firstImage ? (
                  <Image source={{ uri: publishDraft.firstImage }} style={s.publishDraftThumbImg} />
                ) : (
                  <Text style={[s.publishDraftMiniTxt, { color: theme.textMuted }]}>Aperçu</Text>
                )}
              </View>
              <View style={s.publishDraftBody}>
                <Text style={[s.publishDraftLabel, { color: theme.textMuted }]}>Annonce en attente</Text>
                <Text style={[s.publishDraftTitle, { color: theme.text }]} numberOfLines={2}>
                  {publishDraft.title || 'Votre annonce'}
                </Text>
                <Text style={[s.publishDraftMeta, { color: theme.textMuted }]} numberOfLines={1}>
                  {publishDraft.categoryName || 'Catégorie'}{publishDraft.subcategory ? ` • ${publishDraft.subcategory}` : ''}
                </Text>
                <View style={s.publishDraftRow}>
                  {publishDraft.price ? (
                    <View style={[s.publishDraftChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                      <Text style={[s.publishDraftChipTxt, { color: theme.text }]}>{parseInt(publishDraft.price, 10).toLocaleString('fr-FR')} FCFA</Text>
                    </View>
                  ) : null}
                  <View style={[s.publishDraftChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                    <Text style={[s.publishDraftChipTxt, { color: theme.text }]}>{publishDraft.imagesCount || 0} photo{(publishDraft.imagesCount || 0) > 1 ? 's' : ''}</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {/* Hero */}
          <View style={s.hero}>
            {!isPublishFlow ? (
              <Text style={s.heroIcon}>
                {step === STEP_PHONE ? '📱' : step === STEP_LOGIN ? '🔐' : '✨'}
              </Text>
            ) : null}
            <Text style={[s.heroTitle, { color: theme.text }]}>{getTitle()}</Text>
            <Text style={[s.heroSub, { color: theme.textMuted }]}>{getSubtitle()}</Text>
          </View>

          {/* ── ÉTAPE 1 : Téléphone ── */}
          {step === STEP_PHONE && (
            <View style={s.fieldZone}>
              <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Numéro de téléphone</Text>
              <View style={s.phoneWrap}>
                <TouchableOpacity
                  style={[s.dialBadge, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  onPress={() => setShowPicker(true)}
                  activeOpacity={0.85}
                >
                  <Text style={s.dialFlag}>{country.flag}</Text>
                  <Text style={[s.dialCode, { color: theme.text }]}>{country.dialCode}</Text>
                  <Text style={[s.dialArrow, { color: theme.textMuted }]}>▾</Text>
                </TouchableOpacity>
                <TextInput
                  style={[s.phoneInput, { color: theme.text, borderBottomColor: accent }]}
                  placeholder={country.sample}
                  placeholderTextColor={theme.inputPlaceholder}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={(country?.nationalLength || 8) + ((country?.phoneGroups?.length || 1) - 1)}
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  autoFocus
                />
              </View>
              <Text style={[s.phoneHelper, { color: theme.textSoft }]}>Format attendu: {country.sample} ({country.nationalLength} chiffres)</Text>
            </View>
          )}

          {/* ── ÉTAPE 2a : Login (numéro connu) ── */}
          {step === STEP_LOGIN && (
            <>
              {/* Phone affiché (non modifiable) */}
              <View style={s.fieldZone}>
                <Text style={s.fieldLabel}>Numéro de téléphone</Text>
                <View style={[s.phoneReadonly, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <Text style={s.phoneReadonlyFlag}>{country.flag}</Text>
                  <Text style={[s.phoneReadonlyTxt, { color: theme.text }]}>{fmtPhone}</Text>
                  <TouchableOpacity onPress={handleBack}>
                    <Text style={s.phoneChangeTxt}>Modifier</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Mot de passe */}
              <View style={s.fieldZone}>
                <Text style={s.fieldLabel}>Mot de passe</Text>
                <View style={s.pwdWrap}>
                  <TextInput
                    style={[s.pwdInput, { color: theme.text, borderBottomColor: accent }]}
                    placeholder="••••••••"
                    placeholderTextColor={theme.inputPlaceholder}
                    value={password}
                    onChangeText={v => { setPassword(v); setError(''); }}
                    secureTextEntry={!showPwd}
                    autoCapitalize="none"
                    autoFocus
                  />
                  <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPwd(p => !p)}>
                    <Text style={s.eyeBtnTxt}>{showPwd ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Mot de passe oublié */}
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                activeOpacity={0.7}
                style={s.forgotBtn}
              >
                <Text style={s.forgotTxt}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── ÉTAPE 2b : Formulaire minimal (numéro inconnu) ── */}
          {step === STEP_REGISTER && (
            <>
              {/* Phone affiché */}
              <View style={s.fieldZone}>
                <Text style={s.fieldLabel}>Numéro de téléphone</Text>
                  <View style={[s.phoneReadonly, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <Text style={s.phoneReadonlyFlag}>{country.flag}</Text>
                    <Text style={[s.phoneReadonlyTxt, { color: theme.text }]}>{fmtPhone}</Text>
                  <TouchableOpacity onPress={handleBack}>
                    <Text style={s.phoneChangeTxt}>Modifier</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Nom */}
              <View style={s.fieldZone}>
                <Text style={s.fieldLabel}>Nom complet</Text>
                <TextInput
                  style={[s.mainInput, { color: theme.inputText, borderBottomColor: accent, backgroundColor: theme.inputBg }]}
                  placeholder="Ex: Amadou Diallo"
                  placeholderTextColor={theme.inputPlaceholder}
                  value={name}
                  onChangeText={v => { setName(v); setError(''); }}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              {/* Info rassurant */}
              <View style={[s.infoBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                <Text style={s.infoIcon}>🔒</Text>
                <Text style={[s.infoText, { color: theme.text }]}> 
                  Un mot de passe temporaire sera généré. Vous pourrez le modifier plus tard.
                </Text>
              </View>
            </>
          )}

          {/* ── Erreur ── */}
          {error ? (
            <View style={s.errorWrap}>
              <Text style={s.errorTxt}>⚠ {error}</Text>
            </View>
          ) : null}

        </Animated.View>
      </ScrollView>

      {/* ── FOOTER bouton ── */}
      <View style={[s.footer, { backgroundColor: theme.screen, borderTopColor: theme.divider, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}> 
        <TouchableOpacity
          onPress={
            step === STEP_PHONE ? handleCheckPhone :
            step === STEP_LOGIN ? handleLogin :
            handleQuickRegister
          }
          disabled={loading}
          activeOpacity={0.88}
          style={s.submitBtn}
        >
          <LinearGradient
            colors={[P.orange500, P.orange700]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.submitBtnGrad}
          >
            {loading ? (
              <ActivityIndicator color={P.white} />
            ) : (
              <Text style={s.submitBtnTxt}>
                {step === STEP_PHONE
                  ? (isPublishFlow ? 'Continuer vers la publication →' : 'Continuer →')
                  : step === STEP_LOGIN
                    ? (isPublishFlow ? 'Se connecter et publier →' : 'Se connecter →')
                    : (isPublishFlow ? 'Vérifier mon numéro et publier →' : 'Vérifier mon numéro →')}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── MODAL pays ── */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={s.modalRoot}>
          <TouchableOpacity
            style={s.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
          />
          <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 8) }]}> 
            <View style={[s.modalHandle, { backgroundColor: theme.divider }]} />
            <View style={[s.modalHead, { borderBottomColor: theme.border }]}> 
              <Text style={[s.modalTitle, { color: theme.text }]}>Choisir un pays</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={[s.modalClose, { backgroundColor: theme.surfaceAlt }]}>
                <Text style={[s.modalCloseTxt, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {COUNTRIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    s.countryRow,
                    { borderBottomColor: theme.border },
                    country.code === c.code && [s.countryRowActive, { backgroundColor: theme.surfaceAlt }],
                  ]}
                  onPress={() => { setCountry(c); setShowPicker(false); setError(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={s.countryRowFlag}>{c.flag}</Text>
                  <Text style={[s.countryRowName, { color: theme.text }, country.code === c.code && { color: accent }]}> 
                    {c.name}
                  </Text>
                  <Text style={[s.countryRowDial, { color: theme.textMuted }]}>{c.dialCode}</Text>
                  {country.code === c.code && <Text style={{ color: accent, fontWeight: '900' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ── tokens P.* MOBILE_COLORS ──────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.white },

  // ── Header ──
  header:       { paddingHorizontal: 18, paddingBottom: 14, overflow: 'hidden', position: 'relative' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center' },
  backBtnTxt:   { fontSize: 18, fontWeight: '700', color: P.white },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMini:     { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoMiniTxt:  { fontSize: 16, fontWeight: '900', color: P.white },
  headerBrand:  { fontSize: 16, fontWeight: '800', color: P.white },
  altLink:      { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: P.glassWhite25 },
  altLinkTxt:   { fontSize: 12, fontWeight: '600', color: P.white },
  headerGlow:   { height: 1.5 },

  // Step indicator
  stepIndicator: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  stepDot:       { width: 24, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.15)' },
  stepDotActive: { backgroundColor: P.terra },

  // ── Scroll ──
  scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },

  publishDraftCard: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  publishDraftThumb: {
    width: 74,
    height: 74,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishDraftThumbEmoji: {
    fontSize: 30,
  },
  publishDraftThumbImg: {
    width: '100%',
    height: '100%',
  },
  publishDraftMiniTxt: {
    fontSize: 11,
    fontWeight: '700',
  },
  publishDraftBody: {
    flex: 1,
    justifyContent: 'center',
  },
  publishDraftLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  publishDraftTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  publishDraftMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  publishDraftRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  publishDraftChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  publishDraftChipTxt: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Hero ──
  hero:      { alignItems: 'center', marginBottom: 32 },
  heroIcon:  { fontSize: 48, marginBottom: 12 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: P.charcoal, letterSpacing: -0.5, marginBottom: 6, textAlign: 'center' },
  heroSub:   { fontSize: 14, color: P.muted, textAlign: 'center' },
  // ── Fields ──
  fieldZone:  { marginBottom: 24 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: P.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  mainInput:  {
    fontSize: 18, fontWeight: '600', color: P.charcoal,
    borderBottomWidth: 2.5, borderBottomColor: P.terra,
    paddingVertical: 10, backgroundColor: P.white,
  },

  // ── Phone ──
  phoneWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dialBadge:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: P.surface, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: P.dim,
  },
  dialFlag:   { fontSize: 18 },
  dialCode:   { fontSize: 14, fontWeight: '700', color: P.charcoal },
  dialArrow:  { fontSize: 11, color: P.muted },
  phoneInput: {
    flex: 1, fontSize: 18, fontWeight: '600', color: P.charcoal,
    borderBottomWidth: 2.5, borderBottomColor: P.terra, paddingVertical: 10,
  },
  phoneHelper: { fontSize: 12, marginTop: 8 },

  // ── Phone readonly ──
  phoneReadonly:     { flexDirection: 'row', alignItems: 'center', backgroundColor: P.surface, borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: P.dim },
  phoneReadonlyFlag: { fontSize: 20 },
  phoneReadonlyTxt:  { flex: 1, fontSize: 16, fontWeight: '700', color: P.charcoal },
  phoneChangeTxt:    { fontSize: 13, fontWeight: '700', color: P.terra },

  // ── Password ──
  pwdWrap:   { position: 'relative' },
  pwdInput:  {
    fontSize: 18, fontWeight: '600', color: P.charcoal,
    borderBottomWidth: 2.5, borderBottomColor: P.terra,
    paddingVertical: 10, paddingRight: 44,
  },
  eyeBtn:    { position: 'absolute', right: 0, top: 6, padding: 8 },
  eyeBtnTxt: { fontSize: 18 },

  // ── Forgot password ──
  forgotBtn: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 16 },
  forgotTxt: { fontSize: 13, fontWeight: '700', color: P.terra },

  // ── Info box ──
  infoBox:  { flexDirection: 'row', backgroundColor: P.peachSoft, borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: P.terra + '20', marginBottom: 16 },
  infoIcon: { fontSize: 20 },
  infoText: { flex: 1, fontSize: 13, color: P.charcoal, lineHeight: 19 },

  // ── Erreur ──
  errorWrap: {
    backgroundColor: P.errorSoft, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: P.errorBorder, marginTop: 8,
  },
  errorTxt: { fontSize: 13, color: P.error, fontWeight: '600' },

  // ── Footer ──
  footer:        { paddingHorizontal: 20, paddingTop: 12, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.dim },
  submitBtn:     { borderRadius: 14, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  submitBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  submitBtnTxt:  { fontSize: 16, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
  altRow:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  altRowTxt:     { fontSize: 14, color: P.muted },
  altRowLink:    { fontSize: 14, color: P.terra, fontWeight: '700' },

  // ── Modal pays ──
  modalRoot:     { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: P.shadow, opacity: 0.55 },
  modal:         { backgroundColor: P.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '75%' },
  modalHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: P.dim, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: P.dim },
  modalTitle:    { fontSize: 18, fontWeight: '900', color: P.charcoal },
  modalClose:    { width: 30, height: 30, borderRadius: 15, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' },
  modalCloseTxt: { fontSize: 13, color: P.muted, fontWeight: '700' },
  countryRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: P.dim },
  countryRowActive: { backgroundColor: P.peachSoft },
  countryRowFlag:   { fontSize: 26 },
  countryRowName:   { flex: 1, fontSize: 15, fontWeight: '600', color: P.charcoal },
  countryRowDial:   { fontSize: 13, color: P.muted, marginRight: 8 },
});
