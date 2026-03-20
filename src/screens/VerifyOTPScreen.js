// ─── VerifyOTPScreen v2 PREMIUM ─ MarketHub Niger ────────────────────────────
// Vérification OTP — design cohérent, épuré, user-friendly

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { sendOTP, verifyOTP, forgotPassword } from '../api/auth';
import AlertModal from '../components/AlertModal';
import { MOBILE_COLORS as P } from '../theme/colors';

export default function VerifyOTPScreen({ navigation, route }) {
  const {
    phone, identifier, type = 'register',
    attemptsRemaining: initialAttempts = 3,
    devCode, formData,
  } = route.params || {};

  const insets = useSafeAreaInsets();
  const isRegister       = type === 'register';
  const displayIdentifier = phone || identifier;

  const [code,             setCode]             = useState(['', '', '', '', '', '']);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState('');
  const [attemptsLeft,     setAttemptsLeft]     = useState(initialAttempts);
  const [cooldown,         setCooldown]         = useState(0);
  const [devOTPCode,       setDevOTPCode]       = useState(devCode);
  const [alert,            setAlert]            = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  const inputRefs = useRef([]);

  // Animations
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const successAnim= useRef(new Animated.Value(1)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Shake animation pour erreur
  const shakeInputs = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60,  useNativeDriver: true }),
    ]).start();
  };

  const handleChangeText = (text, index) => {
    if (text && !/^\d+$/.test(text)) return;
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    setError('');
    if (text && index < 5) inputRefs.current[index + 1]?.focus();
    if (text && index === 5) {
      const full = newCode.join('');
      if (full.length === 6) handleVerify(full);
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  };

  const handleVerify = async (full = code.join('')) => {
    if (full.length !== 6) { setError('Entrez le code à 6 chiffres'); return; }
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        const result = await verifyOTP(displayIdentifier, full);
        if (result.success && result.data.verified) {
          navigation.replace('RegisterStep2', {
            phone: displayIdentifier, verified: true, formData,
          });
        }
      } else {
        const { verifyResetCode } = await import('../api/auth');
        const result = await verifyResetCode(displayIdentifier, full);
        if (result.success) {
          navigation.replace('ResetPassword', { identifier: displayIdentifier, code: full });
        }
      }
    } catch (err) {
      setError(err.message || 'Code invalide ou expiré');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      shakeInputs();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || attemptsLeft <= 0) return;
    setLoading(true);
    setError('');
    try {
      const result = isRegister
        ? await sendOTP(displayIdentifier)
        : await forgotPassword(displayIdentifier);
      if (result.success) {
        setAlert({
          visible: true,
          type: 'success',
          title: 'Code envoyé ✓',
          message: 'Un nouveau code a été envoyé',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        setAttemptsLeft(result.data?.attemptsRemaining ?? attemptsLeft - 1);
        setCooldown(60);
        const nc = result.devOTP || result.data?.devOTP || result.devCode;
        if (nc) setDevOTPCode(nc);
      }
    } catch (err) {
      setError(err.message || 'Erreur lors du renvoi');
    } finally {
      setLoading(false);
    }
  };

  const isComplete = code.join('').length === 6;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── HEADER ardoise ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#2d3748', '#374151']}
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

          <View style={{ width: 38 }} />
        </View>
        <LinearGradient
          colors={['transparent', P.terra, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.headerGlow}
        />
      </LinearGradient>

      {/* ── CONTENU ────────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Icône + titre */}
          <View style={s.hero}>
            <View style={s.heroIconWrap}>
              <LinearGradient colors={[P.orange500, P.orange700]} style={s.heroIconGrad}>
                <Text style={s.heroIconTxt}>✉</Text>
              </LinearGradient>
              <View style={s.heroRing} />
            </View>
            <Text style={s.heroTitle}>Vérification</Text>
            <Text style={s.heroSub}>
              Code envoyé au{'\n'}
              <Text style={s.heroPhone}>{displayIdentifier}</Text>
            </Text>
          </View>

          {/* Badge dev OTP */}
          {devOTPCode ? (
            <View style={s.devBadge}>
              <Text style={s.devBadgeEye}>🔧</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.devBadgeLabel}>Mode développement</Text>
                <Text style={s.devBadgeCode}>{devOTPCode}</Text>
              </View>
            </View>
          ) : null}

          {/* Inputs OTP */}
          <Animated.View style={[s.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
            {code.map((digit, i) => (
              <TextInput
                key={i}
                ref={r => { inputRefs.current[i] = r; }}
                style={[
                  s.otpInput,
                  digit && s.otpInputFilled,
                  error && s.otpInputError,
                  i === code.filter(Boolean).length && !digit && s.otpInputActive,
                ]}
                value={digit}
                onChangeText={t => handleChangeText(t, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </Animated.View>

          {/* Erreur */}
          {error ? (
            <View style={s.errorWrap}>
              <Text style={s.errorTxt}>⚠ {error}</Text>
            </View>
          ) : null}

          {/* Tentatives restantes */}
          {attemptsLeft < 3 && attemptsLeft > 0 ? (
            <View style={s.attemptsBadge}>
              <Text style={s.attemptsTxt}>
                ⚠ {attemptsLeft} tentative{attemptsLeft > 1 ? 's' : ''} restante{attemptsLeft > 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}

          {/* Bouton vérifier */}
          <TouchableOpacity
            onPress={() => handleVerify()}
            disabled={loading || !isComplete}
            activeOpacity={0.85}
            style={[s.verifyBtn, (!isComplete && !loading) && s.verifyBtnDisabled]}
          >
            <LinearGradient
              colors={isComplete ? [P.orange500, P.orange700] : [P.muted, P.muted]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.verifyBtnGrad}
            >
              {loading
                ? <ActivityIndicator color={P.white} />
                : <Text style={s.verifyBtnTxt}>
                    {isComplete ? '✓ Vérifier le code' : 'Entrez les 6 chiffres'}
                  </Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Renvoyer */}
          <View style={s.resendRow}>
            <Text style={s.resendTxt}>Pas reçu le code ? </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={loading || cooldown > 0 || attemptsLeft <= 0}
              activeOpacity={0.7}
            >
              <Text style={[
                s.resendLink,
                (cooldown > 0 || attemptsLeft <= 0) && s.resendLinkDisabled,
              ]}>
                {cooldown > 0 ? `Renvoyer (${cooldown}s)` : 'Renvoyer →'}
              </Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.surface },

  // Header
  header:       { paddingHorizontal: 18, paddingBottom: 14, overflow: 'hidden', position: 'relative' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  backBtnTxt:   { fontSize: 18, fontWeight: '700', color: P.white },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMini:     { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoMiniTxt:  { fontSize: 15, fontWeight: '900', color: P.white },
  headerBrand:  { fontSize: 16, fontWeight: '800', color: P.white },
  headerGlow:   { height: 1.5 },

  // Scroll
  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },

  // Hero
  hero:         { alignItems: 'center', marginBottom: 32 },
  heroIconWrap: { position: 'relative', marginBottom: 20 },
  heroIconGrad: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: P.terra, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 10 },
  heroIconTxt:  { fontSize: 36, color: P.white },
  heroRing:     { position: 'absolute', top: -8, left: -8, right: -8, bottom: -8, borderRadius: 32, borderWidth: 1.5, borderColor: 'rgba(236,90,19,0.25)' },
  heroTitle:    { fontSize: 28, fontWeight: '900', color: P.charcoal, letterSpacing: -0.5, marginBottom: 10 },
  heroSub:      { fontSize: 15, color: P.muted, textAlign: 'center', lineHeight: 22 },
  heroPhone:    { fontWeight: '800', color: P.terra },

  // Dev badge
  devBadge:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: P.amberSoft, borderWidth: 1, borderColor: P.yellow, borderRadius: 14, padding: 14, marginBottom: 24 },
  devBadgeEye:   { fontSize: 22 },
  devBadgeLabel: { fontSize: 11, fontWeight: '600', color: P.amberDark, marginBottom: 4 },
  devBadgeCode:  { fontSize: 26, fontWeight: '900', color: P.terra, letterSpacing: 6 },

  // OTP inputs
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  otpInput: {
    width: 48, height: 58,
    borderWidth: 2, borderColor: P.dim,
    borderRadius: 14, backgroundColor: P.white,
    textAlign: 'center', fontSize: 24, fontWeight: '900', color: P.charcoal,
    shadowColor: P.charcoal, shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 1,
  },
  otpInputActive: { borderColor: P.terra, borderWidth: 2.5 },
  otpInputFilled: {
    borderColor: P.terra, backgroundColor: P.peachSoft,
    shadowColor: P.terra, shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 3,
  },
  otpInputError:  { borderColor: P.error, backgroundColor: P.errorSoft },

  // Erreur
  errorWrap: { backgroundColor: P.errorSoft, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: P.errorBorder, marginBottom: 16 },
  errorTxt:  { fontSize: 13, color: P.error, fontWeight: '600' },

  // Tentatives
  attemptsBadge: { backgroundColor: P.yellowSoft, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', marginBottom: 16, alignItems: 'center' },
  attemptsTxt:   { fontSize: 13, fontWeight: '700', color: P.amberDark },

  // Bouton vérifier
  verifyBtn:         { borderRadius: 14, overflow: 'hidden', marginBottom: 20, shadowColor: P.terra, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6 },
  verifyBtnDisabled: { shadowOpacity: 0 },
  verifyBtnGrad:     { paddingVertical: 16, alignItems: 'center' },
  verifyBtnTxt:      { fontSize: 16, fontWeight: '800', color: P.white, letterSpacing: 0.2 },

  // Renvoyer
  resendRow:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendTxt:        { fontSize: 14, color: P.muted },
  resendLink:       { fontSize: 14, fontWeight: '700', color: P.terra },
  resendLinkDisabled:{ color: P.muted },
});