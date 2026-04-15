// ─── ForgotPasswordScreen v2 PREMIUM ─ MarketHub Niger ───────────────────────
// Design 100% cohérent avec RegisterScreen, LoginScreen & VerifyOTPScreen
// Zéro valeur hex brute — uniquement les tokens MOBILE_COLORS

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, Animated, KeyboardAvoidingView,
  Platform, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { forgotPassword } from '../api/auth';
import { useAppTheme } from '../contexts/ThemeContext';
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

// ─────────────────────────────────────────────────────────────────────────────
export default function ForgotPasswordScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useAppTheme();

  const [recoveryType, setRecoveryType] = useState(route?.params?.presetType === 'email' ? 'email' : 'phone');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tabAnim = useRef(new Animated.Value(route?.params?.presetType === 'email' ? 1 : 0)).current;

  // Animations — même pattern que Login/Register
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const presetCountryCode = route?.params?.presetCountryCode;
    if (!presetCountryCode) return;
    const matched = COUNTRIES.find((c) => c.code === presetCountryCode);
    if (matched) setCountry(matched);
  }, [route?.params?.presetCountryCode]);

  useEffect(() => {
    if (route?.params?.presetPhone) {
      setPhone(route.params.presetPhone);
      setRecoveryType('phone');
      tabAnim.setValue(0);
    }
    if (route?.params?.presetEmail) {
      setEmail(route.params.presetEmail);
      if (!route?.params?.presetPhone) {
        setRecoveryType('email');
        tabAnim.setValue(1);
      }
    }
  }, [route?.params?.presetEmail, route?.params?.presetPhone, tabAnim]);

  useEffect(() => {
    const maxDigits = country?.nationalLength || 8;
    const currentDigits = normalizePhoneDigits(phone).slice(0, maxDigits);
    setPhone(formatNationalPhone(country, currentDigits));
  }, [country]);

  const handlePhoneChange = (rawValue) => {
    const maxDigits = country?.nationalLength || 8;
    const digits = normalizePhoneDigits(rawValue).slice(0, maxDigits);
    setPhone(formatNationalPhone(country, digits));
    setError('');
  };

  const switchTab = (type) => {
    if (type === recoveryType) return;
    Animated.timing(tabAnim, {
      toValue: type === 'phone' ? 0 : 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
    setRecoveryType(type);
    setError('');
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = () => {
    if (recoveryType === 'phone') {
      const phoneErr = validatePhoneForCountry(country, normalizePhoneDigits(phone));
      if (phoneErr) return phoneErr;
    } else {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return 'Adresse email invalide';
      }
    }
    return null;
  };

  // ── Envoi ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');
    try {
      const phoneDigits = normalizePhoneDigits(phone);
      const identifier = recoveryType === 'phone'
        ? `${country.dialCode} ${phoneDigits}`
        : email.trim().toLowerCase();

      const result = await forgotPassword(identifier);
      if (result.success) {
        navigation.navigate('VerifyOTP', {
          identifier,
          type: 'resetPassword',
          devCode: result.devCode,
        });
      }
    } catch (e) {
      setError(e.message || 'Erreur lors de la demande de réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: theme.screen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ── HEADER ardoise ── identique Login/Register ───────────────── */}
      <LinearGradient
        colors={theme.header}
        style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}
      >
        <View style={s.headerAccent} />

        <View style={s.headerRow}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.glass }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={[s.backBtnTxt, { color: theme.text }]}>←</Text>
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <LinearGradient colors={[P.orange500, P.orange700]} style={s.logoMini}>
              <Text style={s.logoMiniTxt}>M</Text>
            </LinearGradient>
            <Text style={[s.headerBrand, { color: theme.text }]}>MarketHub</Text>
          </View>

          {/* Espace symétrique */}
          <View style={{ width: 38 }} />
        </View>

        <LinearGradient
          colors={[theme.divider, P.terra, theme.divider]}
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

          {/* ── Hero ── identique VerifyOTP ── */}
          <View style={s.hero}>
            <View style={s.heroIconWrap}>
              <LinearGradient colors={[P.orange500, P.orange700]} style={s.heroIconGrad}>
                <Text style={s.heroIconTxt}>🔒</Text>
              </LinearGradient>
              <View style={s.heroRing} />
            </View>
            <Text style={[s.heroTitle, { color: theme.text }]}>Mot de passe oublié ?</Text>
            <Text style={[s.heroSub, { color: theme.textMuted }]}>
              Choisissez email ou téléphone.{'\n'}
              Nous vous enverrons un code de réinitialisation.
            </Text>
          </View>

          <View style={[s.tabWrap, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            <Animated.View
              style={[
                s.tabCursor,
                { backgroundColor: theme.surface },
                {
                  left: tabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['2%', '51%'],
                  }),
                },
              ]}
            />
            <TouchableOpacity style={s.tabBtn} onPress={() => switchTab('phone')} activeOpacity={0.8}>
              <Text style={[s.tabTxt, { color: theme.textMuted }, recoveryType === 'phone' && s.tabTxtActive]}>📱 Téléphone</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.tabBtn} onPress={() => switchTab('email')} activeOpacity={0.8}>
              <Text style={[s.tabTxt, { color: theme.textMuted }, recoveryType === 'email' && s.tabTxtActive]}>✉️ Email</Text>
            </TouchableOpacity>
          </View>

          {/* ── Champ identifiant ── style underline Register ── */}
          <View style={s.fieldZone}>
            <Text style={[s.fieldLabel, { color: theme.textMuted }]}>
              {recoveryType === 'phone' ? 'Numéro de téléphone' : 'Adresse email'}
            </Text>

            {recoveryType === 'phone' ? (
              <View style={s.phoneWrap}>
                <TouchableOpacity
                  style={[s.dialBadge, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  onPress={() => setShowPicker(true)}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <Text style={s.dialFlag}>{country.flag}</Text>
                  <Text style={[s.dialCode, { color: theme.text }]}>{country.dialCode}</Text>
                  <Text style={[s.dialArrow, { color: theme.textMuted }]}>▾</Text>
                </TouchableOpacity>
                <TextInput
                  style={[s.phoneInput, { color: theme.text }]}
                  placeholder={country.sample}
                  placeholderTextColor={theme.inputPlaceholder}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={(country?.nationalLength || 8) + ((country?.phoneGroups?.length || 1) - 1)}
                  autoComplete="tel"
                  autoFocus
                  editable={!loading}
                />
              </View>
            ) : (
              <TextInput
                style={[s.mainInput, { color: theme.text }]}
                placeholder="exemple@email.com"
                placeholderTextColor={theme.inputPlaceholder}
                value={email}
                onChangeText={v => { setEmail(v); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
                editable={!loading}
              />
            )}
          </View>

          {/* ── Erreur ── */}
          {error ? (
            <View style={s.errorWrap}>
              <Text style={s.errorTxt}>⚠ {error}</Text>
            </View>
          ) : null}

          {/* ── Lien retour connexion ── */}
          <View style={s.loginRow}>
            <Text style={[s.loginRowTxt, { color: theme.textMuted }]}>Vous vous souvenez ? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
              <Text style={s.loginRowLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      {/* ── FOOTER bouton ── identique Login/Register ────────────────── */}
      <View style={[s.footer, { backgroundColor: theme.screen, borderTopColor: theme.divider, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <TouchableOpacity
          onPress={handleSend}
          disabled={loading}
          activeOpacity={0.88}
          style={s.sendBtn}
        >
          <LinearGradient
            colors={[P.orange500, P.orange700]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.sendBtnGrad}
          >
            {loading
              ? <ActivityIndicator color={P.white} />
              : <Text style={s.sendBtnTxt}>Envoyer le code →</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowPicker(false)} activeOpacity={1} />
          <View style={[s.pickerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
            <Text style={[s.pickerTitle, { color: theme.text }]}>Choisissez votre pays</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
              {COUNTRIES.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[s.countryRow, { borderBottomColor: theme.divider }, c.code === country.code && s.countryRowActive]}
                  onPress={() => {
                    setCountry(c);
                    setShowPicker(false);
                    setError('');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={s.countryFlag}>{c.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.countryName, { color: theme.text }]}>{c.name}</Text>
                    <Text style={[s.countryCode, { color: theme.textMuted }]}>{c.dialCode}</Text>
                  </View>
                  {c.code === country.code ? <Text style={s.countryCheck}>✓</Text> : null}
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

  // ── Header ardoise ──
  header:       { paddingHorizontal: 18, paddingBottom: 14, overflow: 'hidden', position: 'relative' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: P.glassWhite25, justifyContent: 'center', alignItems: 'center' },
  backBtnTxt:   { fontSize: 18, fontWeight: '700', color: P.white },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMini:     { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoMiniTxt:  { fontSize: 16, fontWeight: '900', color: P.white },
  headerBrand:  { fontSize: 16, fontWeight: '800', color: P.white },
  headerGlow:   { height: 1.5 },

  // ── Scroll ──
  scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },

  // ── Hero ──
  hero:         { alignItems: 'center', marginBottom: 36 },
  heroIconWrap: { position: 'relative', marginBottom: 20 },
  heroIconGrad: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: P.terra, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 10,
  },
  heroIconTxt: { fontSize: 36 },
  heroRing:    {
    position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 32, borderWidth: 1.5, borderColor: P.orange300,
  },
  heroTitle:   { fontSize: 26, fontWeight: '900', color: P.charcoal, letterSpacing: -0.5, marginBottom: 10, textAlign: 'center' },
  heroSub:     { fontSize: 14, color: P.muted, textAlign: 'center', lineHeight: 22 },

  // ── Tabs ──
  tabWrap: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    position: 'relative',
  },
  tabCursor: {
    position: 'absolute',
    top: 4,
    width: '47%',
    height: 38,
    borderRadius: 11,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  tabTxt: { fontSize: 13, fontWeight: '700' },
  tabTxtActive: { color: P.terra },

  // ── Champ underline ──
  fieldZone:  { marginBottom: 24 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: P.muted,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  mainInput: {
    fontSize: 18, fontWeight: '600', color: P.charcoal,
    borderBottomWidth: 2.5, borderBottomColor: P.terra,
    paddingVertical: 10, backgroundColor: 'transparent',
  },
  phoneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dialBadge: {
    borderWidth: 1,
    borderColor: P.dim,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dialFlag: { fontSize: 18 },
  dialCode: { fontSize: 14, fontWeight: '700' },
  dialArrow: { fontSize: 12, fontWeight: '700' },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    borderBottomWidth: 2.5,
    borderBottomColor: P.terra,
    paddingVertical: 10,
  },

  // ── Country picker ──
  modalOverlay: {
    flex: 1,
    backgroundColor: P.glassBlack50,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  pickerCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  countryRowActive: {
    backgroundColor: P.peachSoft,
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  countryFlag: { fontSize: 20 },
  countryName: { fontSize: 14, fontWeight: '700' },
  countryCode: { fontSize: 12, fontWeight: '600' },
  countryCheck: { fontSize: 15, fontWeight: '900', color: P.terra },

  // ── Erreur ──
  errorWrap: {
    backgroundColor: P.errorSoft, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: P.errorBorder,
    marginBottom: 20,
  },
  errorTxt: { fontSize: 13, color: P.error, fontWeight: '600' },

  // ── Lien connexion ──
  loginRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  loginRowTxt:  { fontSize: 14, color: P.muted },
  loginRowLink: { fontSize: 14, color: P.terra, fontWeight: '700' },

  // ── Footer ──
  footer:      { paddingHorizontal: 20, paddingTop: 12, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.dim },
  sendBtn:     { borderRadius: 14, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  sendBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  sendBtnTxt:  { fontSize: 16, fontWeight: '800', color: P.white, letterSpacing: 0.2 },
});