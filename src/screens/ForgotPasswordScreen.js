// ─── ForgotPasswordScreen v2 PREMIUM ─ MarketHub Niger ───────────────────────
// Design 100% cohérent avec RegisterScreen, LoginScreen & VerifyOTPScreen
// Zéro valeur hex brute — uniquement les tokens MOBILE_COLORS

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, Animated, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { forgotPassword } from '../api/auth';
import { MOBILE_COLORS as P } from '../theme/colors';

// ─────────────────────────────────────────────────────────────────────────────
export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  // Animations — même pattern que Login/Register
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = () => {
    const trimmed = identifier.trim();
    if (!trimmed)
      return 'Veuillez entrer votre email ou numéro de téléphone';
    const isEmail = trimmed.includes('@');
    const isPhone = /^\+?\d[\d\s]{6,}$/.test(trimmed);
    if (!isEmail && !isPhone)
      return 'Format invalide. Entrez un email ou un numéro de téléphone';
    return null;
  };

  // ── Envoi ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');
    try {
      const result = await forgotPassword(identifier.trim());
      if (result.success) {
        navigation.navigate('VerifyOTP', {
          identifier: identifier.trim(),
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
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── HEADER ardoise ── identique Login/Register ───────────────── */}
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

          {/* Espace symétrique */}
          <View style={{ width: 38 }} />
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

          {/* ── Hero ── identique VerifyOTP ── */}
          <View style={s.hero}>
            <View style={s.heroIconWrap}>
              <LinearGradient colors={[P.orange500, P.orange700]} style={s.heroIconGrad}>
                <Text style={s.heroIconTxt}>🔒</Text>
              </LinearGradient>
              <View style={s.heroRing} />
            </View>
            <Text style={s.heroTitle}>Mot de passe oublié ?</Text>
            <Text style={s.heroSub}>
              Entrez votre email ou numéro de téléphone.{'\n'}
              Nous vous enverrons un code de réinitialisation.
            </Text>
          </View>

          {/* ── Champ identifiant ── style underline Register ── */}
          <View style={s.fieldZone}>
            <Text style={s.fieldLabel}>Email ou Téléphone</Text>
            <TextInput
              style={s.mainInput}
              placeholder="exemple@email.com ou +227 12345678"
              placeholderTextColor={P.muted}
              value={identifier}
              onChangeText={v => { setIdentifier(v); setError(''); }}
              keyboardType="default"
              autoCapitalize="none"
              autoFocus
              editable={!loading}
            />
          </View>

          {/* ── Erreur ── */}
          {error ? (
            <View style={s.errorWrap}>
              <Text style={s.errorTxt}>⚠ {error}</Text>
            </View>
          ) : null}

          {/* ── Lien retour connexion ── */}
          <View style={s.loginRow}>
            <Text style={s.loginRowTxt}>Vous vous souvenez ? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
              <Text style={s.loginRowLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      {/* ── FOOTER bouton ── identique Login/Register ────────────────── */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
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

  // ── Champ underline ──
  fieldZone:  { marginBottom: 24 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: P.muted,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  mainInput: {
    fontSize: 18, fontWeight: '600', color: P.charcoal,
    borderBottomWidth: 2.5, borderBottomColor: P.terra,
    paddingVertical: 10, backgroundColor: P.white,
  },

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