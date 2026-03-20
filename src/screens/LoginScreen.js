// ─── LoginScreen v2 PREMIUM ─ MarketHub Niger ────────────────────────────────
// Design 100% cohérent avec RegisterScreen & VerifyOTPScreen
// Zéro valeur hex brute — uniquement les tokens MOBILE_COLORS

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, Animated, KeyboardAvoidingView,
  Platform, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { MOBILE_COLORS as P } from '../theme/colors';

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
export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [loginType,  setLoginType]  = useState('phone');
  const [country,    setCountry]    = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [phone,      setPhone]      = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPwd,    setShowPwd]    = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const tabAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
    loadSaved();
  }, []);

  const switchTab = (type) => {
    if (type === loginType) return;
    Animated.timing(tabAnim, {
      toValue: type === 'phone' ? 0 : 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
    setLoginType(type);
    setError('');
  };

  const loadSaved = async () => {
    try {
      const rem = await AsyncStorage.getItem('rememberMe');
      const sPh = await AsyncStorage.getItem('savedPhone');
      const sEm = await AsyncStorage.getItem('savedEmail');
      if (rem === 'true') {
        setRememberMe(true);
        if (sPh) setPhone(sPh);
        if (sEm) setEmail(sEm);
      }
    } catch (_) {}
  };

  const validate = () => {
    if (loginType === 'phone') {
      if (!phone.trim() || phone.trim().length < 7)
        return 'Numéro invalide (min 7 chiffres)';
    } else {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return 'Adresse email invalide';
    }
    if (!password) return 'Mot de passe requis';
    return null;
  };

  const handleLogin = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');
    try {
      const identifier = loginType === 'phone'
        ? `${country.dialCode} ${phone.trim()}`
        : email.trim();
      const result = await login(identifier, password);
      if (!result.success) { setError(result.message || 'Identifiants incorrects.'); return; }
      if (rememberMe) {
        await AsyncStorage.setItem('rememberMe', 'true');
        loginType === 'phone'
          ? await AsyncStorage.setItem('savedPhone', phone)
          : await AsyncStorage.setItem('savedEmail', email);
      } else {
        await AsyncStorage.multiRemove(['rememberMe', 'savedPhone', 'savedEmail']);
      }

      // Stopper le loader avant navigation pour éviter un état visuel bloqué.
      setLoading(false);

      // Navigation robuste: fonctionne même si Login n'a pas d'écran précédent.
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
      });
    } catch (e) {
      setError(e.message || 'Identifiants incorrects. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── HEADER ardoise ── */}
      <LinearGradient
        colors={[P.brown, P.charcoal]}
        style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}
      >
        <View style={s.headerAccent} />

        <View style={s.headerRow}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={s.backBtnTxt}>←</Text>
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <LinearGradient colors={[P.orange500, P.orange700]} style={s.logoMini}>
              <Text style={s.logoMiniTxt}>M</Text>
            </LinearGradient>
            <Text style={s.headerBrand}>MarketHub</Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={s.registerLink}
          >
            <Text style={s.registerLinkTxt}>S'inscrire</Text>
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={[P.charcoal, P.terra, P.charcoal]}
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
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Hero */}
          <View style={s.hero}>
            <View style={s.heroIconWrap}>
              <LinearGradient colors={[P.orange500, P.orange700]} style={s.heroIconGrad}>
                <Text style={s.heroIconTxt}>👋</Text>
              </LinearGradient>
              <View style={s.heroRing} />
            </View>
            <Text style={s.heroTitle}>Bon retour !</Text>
            <Text style={s.heroSub}>Connectez-vous à votre compte</Text>
          </View>

          {/* ── Toggle onglets animés ── */}
          <View style={s.tabWrap}>
            <Animated.View
              style={[
                s.tabCursor,
                {
                  left: tabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['2%', '51%'],
                  }),
                },
              ]}
            />
            <TouchableOpacity style={s.tabBtn} onPress={() => switchTab('phone')} activeOpacity={0.8}>
              <Text style={[s.tabTxt, loginType === 'phone' && s.tabTxtActive]}>📱 Téléphone</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.tabBtn} onPress={() => switchTab('email')} activeOpacity={0.8}>
              <Text style={[s.tabTxt, loginType === 'email' && s.tabTxtActive]}>✉️ Email</Text>
            </TouchableOpacity>
          </View>

          {/* ── Champ identifiant ── */}
          <View style={s.fieldZone}>
            <Text style={s.fieldLabel}>
              {loginType === 'phone' ? 'Numéro de téléphone' : 'Email'}
            </Text>

            {loginType === 'phone' ? (
              <View style={s.phoneWrap}>
                <TouchableOpacity
                  style={s.dialBadge}
                  onPress={() => setShowPicker(true)}
                  activeOpacity={0.85}
                >
                  <Text style={s.dialFlag}>{country.flag}</Text>
                  <Text style={s.dialCode}>{country.dialCode}</Text>
                  <Text style={s.dialArrow}>▾</Text>
                </TouchableOpacity>
                <TextInput
                  style={s.phoneInput}
                  placeholder="12 34 56 78"
                  placeholderTextColor={P.muted}
                  value={phone}
                  onChangeText={v => { setPhone(v); setError(''); }}
                  keyboardType="phone-pad"
                />
              </View>
            ) : (
              <TextInput
                style={s.mainInput}
                placeholder="exemple@email.com"
                placeholderTextColor={P.muted}
                value={email}
                onChangeText={v => { setEmail(v); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
          </View>

          {/* ── Mot de passe ── */}
          <View style={s.fieldZone}>
            <Text style={s.fieldLabel}>Mot de passe</Text>
            <View style={s.pwdWrap}>
              <TextInput
                style={s.pwdInput}
                placeholder="••••••••"
                placeholderTextColor={P.muted}
                value={password}
                onChangeText={v => { setPassword(v); setError(''); }}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPwd(p => !p)}>
                <Text style={s.eyeBtnTxt}>{showPwd ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Options ── */}
          <View style={s.optionsRow}>
            <TouchableOpacity
              style={s.rememberRow}
              onPress={() => setRememberMe(v => !v)}
              activeOpacity={0.7}
            >
              <View style={[s.checkbox, rememberMe && s.checkboxOn]}>
                {rememberMe && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.rememberTxt}>Se souvenir de moi</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} activeOpacity={0.7}>
              <Text style={s.forgotTxt}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          </View>

          {/* ── Erreur ── */}
          {error ? (
            <View style={s.errorWrap}>
              <Text style={s.errorTxt}>⚠ {error}</Text>
            </View>
          ) : null}

        </Animated.View>
      </ScrollView>

      {/* ── FOOTER bouton ── */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.88}
          style={s.loginBtn}
        >
          <LinearGradient
            colors={[P.orange500, P.orange700]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.loginBtnGrad}
          >
            {loading
              ? <ActivityIndicator color={P.white} />
              : <Text style={s.loginBtnTxt}>Se connecter →</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        <View style={s.registerRow}>
          <Text style={s.registerRowTxt}>Pas encore de compte ? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={s.registerRowLink}>Créer un compte</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MODAL pays ── */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        {/*
          Structure correcte du bottom-sheet :
          - modalRoot     : flex:1, justifyContent:'flex-end' — colle le sheet en bas
          - modalBackdrop : StyleSheet.absoluteFillObject + opacity — fond semi-transparent
          - modal         : la feuille blanche visible
        */}
        <View style={s.modalRoot}>
          {/* Backdrop semi-transparent cliquable pour fermer */}
          <TouchableOpacity
            style={s.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
          />

          {/* Sheet */}
          <View style={[s.modal, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={s.modalHandle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Choisir un pays</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={s.modalClose}>
                <Text style={s.modalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {COUNTRIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={[s.countryRow, country.code === c.code && s.countryRowActive]}
                  onPress={() => { setCountry(c); setShowPicker(false); setError(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={s.countryRowFlag}>{c.flag}</Text>
                  <Text style={[s.countryRowName, country.code === c.code && s.countryRowNameActive]}>
                    {c.name}
                  </Text>
                  <Text style={s.countryRowDial}>{c.dialCode}</Text>
                  {country.code === c.code && <Text style={s.countryRowCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ── 100% tokens P.* de MOBILE_COLORS ──────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.white },

  // ── Header ──
  header:          { paddingHorizontal: 18, paddingBottom: 14, overflow: 'hidden', position: 'relative' },
  headerAccent:    { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn:         { width: 38, height: 38, borderRadius: 19, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center' },
  backBtnTxt:      { fontSize: 18, fontWeight: '700', color: P.white },
  headerCenter:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMini:        { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoMiniTxt:     { fontSize: 16, fontWeight: '900', color: P.white },
  headerBrand:     { fontSize: 16, fontWeight: '800', color: P.white },
  registerLink:    { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: P.glassWhite25 },
  registerLinkTxt: { fontSize: 12, fontWeight: '600', color: P.white },
  headerGlow:      { height: 1.5 },

  // ── Scroll ──
  scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },

  // ── Hero ──
  hero:         { alignItems: 'center', marginBottom: 28 },
  heroIconWrap: { position: 'relative', marginBottom: 16 },
  heroIconGrad: {
    width: 72, height: 72, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: P.terra, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 8,
  },
  heroIconTxt:  { fontSize: 32 },
  heroRing:     {
    position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 30, borderWidth: 1.5, borderColor: P.orange300,
  },
  heroTitle:    { fontSize: 26, fontWeight: '900', color: P.charcoal, letterSpacing: -0.5, marginBottom: 6 },
  heroSub:      { fontSize: 14, color: P.muted, textAlign: 'center' },

  // ── Toggle onglets ──
  tabWrap: {
    flexDirection: 'row', backgroundColor: P.surface,
    borderRadius: 14, padding: 4, marginBottom: 28,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: P.dim,
  },
  tabCursor: {
    position: 'absolute', top: 4, bottom: 4, width: '47%',
    backgroundColor: P.white, borderRadius: 10,
    shadowColor: P.terra, shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3,
  },
  tabBtn:       { flex: 1, paddingVertical: 11, alignItems: 'center', zIndex: 1 },
  tabTxt:       { fontSize: 14, fontWeight: '600', color: P.muted },
  tabTxtActive: { color: P.terra, fontWeight: '800' },

  // ── Champs underline ──
  fieldZone:  { marginBottom: 24 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: P.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  mainInput: {
    fontSize: 18, fontWeight: '600', color: P.charcoal,
    borderBottomWidth: 2.5, borderBottomColor: P.terra,
    paddingVertical: 10, backgroundColor: P.white,
  },

  // ── Phone ──
  phoneWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dialBadge: {
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

  // ── Password ──
  pwdWrap:   { position: 'relative' },
  pwdInput:  {
    fontSize: 18, fontWeight: '600', color: P.charcoal,
    borderBottomWidth: 2.5, borderBottomColor: P.terra,
    paddingVertical: 10, paddingRight: 44,
  },
  eyeBtn:    { position: 'absolute', right: 0, top: 6, padding: 8 },
  eyeBtnTxt: { fontSize: 18 },

  // ── Options ──
  optionsRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox:    { width: 22, height: 22, borderWidth: 2, borderColor: P.dim, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  checkboxOn:  { backgroundColor: P.terra, borderColor: P.terra },
  checkmark:   { color: P.white, fontSize: 13, fontWeight: '900' },
  rememberTxt: { fontSize: 13, fontWeight: '600', color: P.charcoal },
  forgotTxt:   { fontSize: 13, fontWeight: '700', color: P.terra },

  // ── Erreur ──
  errorWrap: {
    backgroundColor: P.errorSoft, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: P.errorBorder,
  },
  errorTxt: { fontSize: 13, color: P.error, fontWeight: '600' },

  // ── Footer ──
  footer:          { paddingHorizontal: 20, paddingTop: 12, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.dim },
  loginBtn:        { borderRadius: 14, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  loginBtnGrad:    { paddingVertical: 16, alignItems: 'center' },
  loginBtnTxt:     { fontSize: 16, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
  registerRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  registerRowTxt:  { fontSize: 14, color: P.muted },
  registerRowLink: { fontSize: 14, color: P.terra, fontWeight: '700' },

  // ── Modal pays ──
  // Note : P.shadow = '#000000', on applique l'opacité via opacity sur la View
  modalRoot:           { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: P.shadow, opacity: 0.55 },
  modal:               { backgroundColor: P.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '75%' },
  modalHandle:         { width: 36, height: 4, borderRadius: 2, backgroundColor: P.dim, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHead:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: P.dim },
  modalTitle:          { fontSize: 18, fontWeight: '900', color: P.charcoal },
  modalClose:          { width: 30, height: 30, borderRadius: 15, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' },
  modalCloseTxt:       { fontSize: 13, color: P.muted, fontWeight: '700' },
  countryRow:          { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: P.dim },
  countryRowActive:    { backgroundColor: P.peachSoft },
  countryRowFlag:      { fontSize: 26 },
  countryRowName:      { flex: 1, fontSize: 15, fontWeight: '600', color: P.charcoal },
  countryRowNameActive:{ color: P.terra },
  countryRowDial:      { fontSize: 13, color: P.muted, marginRight: 8 },
  countryRowCheck:     { color: P.terra, fontWeight: '900' },
});